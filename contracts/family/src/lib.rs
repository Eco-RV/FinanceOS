#![no_std]
//! # Familia (Constelación familiar, Finance OS 3.0.0)
//!
//! Familia y bóveda de ahorro en USDC sobre Stellar:
//!
//! - La familia guarda **solo direcciones y roles** (K2): nombres, apodos y
//!   parentescos viven fuera de la cadena, en Finance OS.
//! - Quien crea la familia es su **núcleo**: siempre guardián, no sale ni se
//!   quita, nombra guardianes y fija cuántas aprobaciones pide un retiro (K6).
//! - Cualquier estrella deposita USDC en la **bóveda** (K3). Retirar necesita
//!   la aprobación de guardianes **distintos de quien pide** (K4) y el destino
//!   es siempre una estrella de la familia (K5). Si el núcleo pide y es el
//!   único guardián, el retiro se ejecuta directo.
//! - Un retiro pendiente vence a los 7 días (K7).
//!
//! Este contrato **custodia fondos**: antes de mainnet necesita una revisión
//! de seguridad (checklist de la skill `soroban-contracts`).
use soroban_sdk::{
    Address, BytesN, Env, Vec, contract, contracterror, contractevent, contractimpl, contracttype,
    token::TokenClient,
};

/// Máximo de estrellas por familia (K6).
pub const MAX_MEMBERS: u32 = 12;
/// Máximo de familias a las que pertenece una dirección (K6).
pub const MAX_FAMILIES_PER_ADDRESS: u32 = 5;
/// Máximo de retiros pendientes por familia (K7).
pub const MAX_PENDING: u32 = 10;
/// Un retiro pendiente vence a los 7 días (K7), en segundos.
pub const WITHDRAWAL_TTL_SECS: u64 = 7 * 24 * 60 * 60;

// Las entradas persistentes viven ~30 días (en ledgers de ~5 s) tras cada escritura.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_EXTEND_TO - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Esa familia no existe.
    FamilyNotFound = 1,
    /// Esa dirección no es parte de la familia.
    NotMember = 2,
    /// Solo un guardián de la familia puede hacer esto.
    NotGuardian = 3,
    /// Solo el núcleo de la familia puede hacer esto.
    NotCore = 4,
    /// Esa dirección ya es parte de la familia.
    AlreadyMember = 5,
    /// La familia ya tiene el máximo de 12 estrellas.
    FamilyFull = 6,
    /// Esa dirección ya está en el máximo de 5 familias.
    TooManyFamilies = 7,
    /// El núcleo de la familia no se puede quitar, cambiar de rol ni salir.
    CoreIsFixed = 8,
    /// El monto debe ser mayor que cero.
    InvalidAmount = 9,
    /// La bóveda no tiene saldo suficiente.
    InsufficientBalance = 10,
    /// Ese retiro no existe.
    WithdrawalNotFound = 11,
    /// Ese retiro ya se resolvió.
    WithdrawalNotPending = 12,
    /// No puedes aprobar tu propio retiro: lo aprueba otro guardián.
    SelfApproval = 13,
    /// Ya aprobaste este retiro.
    AlreadyApproved = 14,
    /// Este retiro venció (7 días): pide uno nuevo.
    WithdrawalExpired = 15,
    /// El retiro solo puede ir a una estrella de la familia.
    DestinationNotMember = 16,
    /// La familia tiene demasiados retiros pendientes: resuelve alguno primero.
    TooManyPending = 17,
    /// Las aprobaciones deben ser al menos 1.
    InvalidApprovals = 18,
    /// Solo quien pidió el retiro o un guardián puede cancelarlo.
    NotAllowedToCancel = 19,
    /// La meta no puede ser negativa.
    InvalidGoal = 20,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Role {
    /// Aprueba retiros de otros, agrega estrellas y fija la meta.
    Guardian,
    /// Deposita y pide retiros.
    Member,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Member {
    pub address: Address,
    pub role: Role,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Family {
    pub id: u32,
    /// Quien creó la familia: siempre guardián, no sale ni se quita.
    pub core: Address,
    /// Incluye al núcleo (máximo `MAX_MEMBERS`).
    pub members: Vec<Member>,
    /// Meta de ahorro de la bóveda (USDC, 7 decimales). 0 = sin meta.
    pub goal: i128,
    /// Saldo de la bóveda (USDC, 7 decimales).
    pub balance: i128,
    /// Aprobaciones que pide un retiro (mínimo 1; se recorta a los guardianes que pueden aprobar).
    pub approvals_needed: u32,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum WithdrawalStatus {
    Pending,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdrawal {
    pub id: u32,
    pub family_id: u32,
    /// Destino: una estrella de la familia (K5).
    pub to: Address,
    pub amount: i128,
    pub requested_by: Address,
    /// Guardianes que ya aprobaron (distintos de quien pidió).
    pub approvals: Vec<Address>,
    /// Aprobaciones necesarias, fijadas al pedir.
    pub required: u32,
    pub status: WithdrawalStatus,
    /// Unix segundos.
    pub created_at: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    /// SAC del USDC que guarda la bóveda.
    Usdc,
    /// Familias creadas (siguiente id).
    FamilyCount,
    /// Retiros pedidos (siguiente id).
    WithdrawalCount,
    /// id → Family
    Family(u32),
    /// dirección → ids de sus familias (máximo `MAX_FAMILIES_PER_ADDRESS`)
    FamiliesOf(Address),
    /// (familia, dirección) → total depositado
    Contribution(u32, Address),
    /// id → Withdrawal
    Withdrawal(u32),
    /// familia → ids de sus retiros pendientes (máximo `MAX_PENDING`)
    Pending(u32),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FamilyCreated {
    #[topic]
    pub family_id: u32,
    pub core: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberAdded {
    #[topic]
    pub family_id: u32,
    pub member: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberRemoved {
    #[topic]
    pub family_id: u32,
    pub member: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleChanged {
    #[topic]
    pub family_id: u32,
    pub member: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalSet {
    #[topic]
    pub family_id: u32,
    pub goal: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deposited {
    #[topic]
    pub family_id: u32,
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRequested {
    #[topic]
    pub family_id: u32,
    pub withdrawal_id: u32,
    pub requested_by: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalApproved {
    #[topic]
    pub family_id: u32,
    pub withdrawal_id: u32,
    pub guardian: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalExecuted {
    #[topic]
    pub family_id: u32,
    pub withdrawal_id: u32,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalCancelled {
    #[topic]
    pub family_id: u32,
    pub withdrawal_id: u32,
}

#[contract]
pub struct FamilyVault;

#[contractimpl]
impl FamilyVault {
    /// `admin` solo puede hacer `upgrade` (no tiene poder sobre familias ni
    /// fondos). `usdc` es el SAC del USDC que guarda la bóveda.
    pub fn __constructor(env: Env, admin: Address, usdc: Address) {
        let instance = env.storage().instance();
        instance.set(&DataKey::Admin, &admin);
        instance.set(&DataKey::Usdc, &usdc);
    }

    /// Crea una familia; quien firma (`creator`) queda como su núcleo.
    pub fn create_family(env: Env, creator: Address) -> Result<u32, Error> {
        creator.require_auth();

        let instance = env.storage().instance();
        let id: u32 = instance.get(&DataKey::FamilyCount).unwrap_or(0);
        link_family(&env, &creator, id)?;
        instance.set(&DataKey::FamilyCount, &(id + 1));
        instance.extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);

        let mut members = Vec::new(&env);
        members.push_back(Member {
            address: creator.clone(),
            role: Role::Guardian,
        });
        save_family(
            &env,
            &Family {
                id,
                core: creator.clone(),
                members,
                goal: 0,
                balance: 0,
                approvals_needed: 1,
            },
        );

        FamilyCreated {
            family_id: id,
            core: creator,
        }
        .publish(&env);
        Ok(id)
    }

    /// Agrega una estrella. Un guardián agrega miembros; solo el núcleo
    /// nombra guardianes (K6).
    pub fn add_member(
        env: Env,
        guardian: Address,
        family_id: u32,
        member: Address,
        role: Role,
    ) -> Result<(), Error> {
        guardian.require_auth();
        let mut family = load_family(&env, family_id)?;
        require_guardian(&family, &guardian)?;
        if role == Role::Guardian && guardian != family.core {
            return Err(Error::NotCore);
        }
        if position_of(&family, &member).is_some() {
            return Err(Error::AlreadyMember);
        }
        if family.members.len() >= MAX_MEMBERS {
            return Err(Error::FamilyFull);
        }
        link_family(&env, &member, family_id)?;

        family.members.push_back(Member {
            address: member.clone(),
            role,
        });
        save_family(&env, &family);
        MemberAdded {
            family_id,
            member,
            role,
        }
        .publish(&env);
        Ok(())
    }

    /// Quita una estrella. Un guardián quita miembros; solo el núcleo quita
    /// guardianes. El núcleo no se quita (K6).
    pub fn remove_member(
        env: Env,
        guardian: Address,
        family_id: u32,
        member: Address,
    ) -> Result<(), Error> {
        guardian.require_auth();
        let mut family = load_family(&env, family_id)?;
        require_guardian(&family, &guardian)?;
        if member == family.core {
            return Err(Error::CoreIsFixed);
        }
        let index = position_of(&family, &member).ok_or(Error::NotMember)?;
        if family.members.get_unchecked(index).role == Role::Guardian && guardian != family.core {
            return Err(Error::NotCore);
        }
        family.members.remove(index);
        unlink_family(&env, &member, family_id);
        save_family(&env, &family);
        MemberRemoved { family_id, member }.publish(&env);
        Ok(())
    }

    /// Una estrella (que no sea el núcleo) se sale de la familia.
    pub fn leave_family(env: Env, member: Address, family_id: u32) -> Result<(), Error> {
        member.require_auth();
        let mut family = load_family(&env, family_id)?;
        if member == family.core {
            return Err(Error::CoreIsFixed);
        }
        let index = position_of(&family, &member).ok_or(Error::NotMember)?;
        family.members.remove(index);
        unlink_family(&env, &member, family_id);
        save_family(&env, &family);
        MemberRemoved { family_id, member }.publish(&env);
        Ok(())
    }

    /// Cambia el rol de una estrella. Solo el núcleo; el núcleo no cambia de rol.
    pub fn set_role(
        env: Env,
        core: Address,
        family_id: u32,
        member: Address,
        role: Role,
    ) -> Result<(), Error> {
        core.require_auth();
        let mut family = load_family(&env, family_id)?;
        require_core(&family, &core)?;
        if member == family.core {
            return Err(Error::CoreIsFixed);
        }
        let index = position_of(&family, &member).ok_or(Error::NotMember)?;
        family.members.set(
            index,
            Member {
                address: member.clone(),
                role,
            },
        );
        save_family(&env, &family);
        RoleChanged {
            family_id,
            member,
            role,
        }
        .publish(&env);
        Ok(())
    }

    /// Cuántas aprobaciones pide un retiro (mínimo 1). Solo el núcleo.
    pub fn set_approvals(
        env: Env,
        core: Address,
        family_id: u32,
        approvals_needed: u32,
    ) -> Result<(), Error> {
        core.require_auth();
        let mut family = load_family(&env, family_id)?;
        require_core(&family, &core)?;
        if approvals_needed == 0 {
            return Err(Error::InvalidApprovals);
        }
        family.approvals_needed = approvals_needed;
        save_family(&env, &family);
        Ok(())
    }

    /// Fija la meta de la bóveda (USDC, 7 decimales; 0 = sin meta). Un guardián.
    pub fn set_goal(env: Env, guardian: Address, family_id: u32, goal: i128) -> Result<(), Error> {
        guardian.require_auth();
        let mut family = load_family(&env, family_id)?;
        require_guardian(&family, &guardian)?;
        if goal < 0 {
            return Err(Error::InvalidGoal);
        }
        family.goal = goal;
        save_family(&env, &family);
        GoalSet { family_id, goal }.publish(&env);
        Ok(())
    }

    /// Deposita USDC en la bóveda (K3). Firma `from`, que debe ser de la familia.
    pub fn deposit(env: Env, from: Address, family_id: u32, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut family = load_family(&env, family_id)?;
        if position_of(&family, &from).is_none() {
            return Err(Error::NotMember);
        }

        usdc(&env).transfer(&from, env.current_contract_address(), &amount);

        family.balance = family
            .balance
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        save_family(&env, &family);

        let key = DataKey::Contribution(family_id, from.clone());
        let storage = env.storage().persistent();
        let total: i128 = storage.get(&key).unwrap_or(0);
        storage.set(&key, &(total + amount));
        storage.extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Deposited {
            family_id,
            from,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Pide un retiro de la bóveda hacia una estrella de la familia (K5).
    /// Devuelve su id. Si no hay ningún guardián distinto de quien pide (el
    /// núcleo solo), se ejecuta en el acto (K4).
    pub fn request_withdrawal(
        env: Env,
        member: Address,
        family_id: u32,
        to: Address,
        amount: i128,
    ) -> Result<u32, Error> {
        member.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut family = load_family(&env, family_id)?;
        if position_of(&family, &member).is_none() {
            return Err(Error::NotMember);
        }
        if position_of(&family, &to).is_none() {
            return Err(Error::DestinationNotMember);
        }
        if amount > family.balance {
            return Err(Error::InsufficientBalance);
        }

        let instance = env.storage().instance();
        let id: u32 = instance.get(&DataKey::WithdrawalCount).unwrap_or(0);
        instance.set(&DataKey::WithdrawalCount, &(id + 1));
        instance.extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);

        let eligible = eligible_approvers(&family, &member);
        let mut withdrawal = Withdrawal {
            id,
            family_id,
            to: to.clone(),
            amount,
            requested_by: member.clone(),
            approvals: Vec::new(&env),
            required: family.approvals_needed.min(eligible),
            status: WithdrawalStatus::Pending,
            created_at: env.ledger().timestamp(),
        };
        WithdrawalRequested {
            family_id,
            withdrawal_id: id,
            requested_by: member,
            to,
            amount,
        }
        .publish(&env);

        if withdrawal.required == 0 {
            execute(&env, &mut family, &mut withdrawal)?;
        } else {
            let mut pending = pending_ids(&env, family_id);
            if pending.len() >= MAX_PENDING {
                return Err(Error::TooManyPending);
            }
            pending.push_back(id);
            save_pending(&env, family_id, &pending);
            save_withdrawal(&env, &withdrawal);
        }
        Ok(id)
    }

    /// Un guardián (distinto de quien pidió) aprueba un retiro. Con las
    /// aprobaciones necesarias se ejecuta (K4). Devuelve `true` si se ejecutó.
    pub fn approve_withdrawal(
        env: Env,
        guardian: Address,
        withdrawal_id: u32,
    ) -> Result<bool, Error> {
        guardian.require_auth();
        let mut withdrawal = load_withdrawal(&env, withdrawal_id)?;
        if withdrawal.status != WithdrawalStatus::Pending {
            return Err(Error::WithdrawalNotPending);
        }
        let mut family = load_family(&env, withdrawal.family_id)?;
        require_guardian(&family, &guardian)?;
        if guardian == withdrawal.requested_by {
            return Err(Error::SelfApproval);
        }
        if withdrawal.approvals.contains(&guardian) {
            return Err(Error::AlreadyApproved);
        }
        if is_expired(&env, &withdrawal) {
            return Err(Error::WithdrawalExpired);
        }

        withdrawal.approvals.push_back(guardian.clone());
        WithdrawalApproved {
            family_id: withdrawal.family_id,
            withdrawal_id,
            guardian,
        }
        .publish(&env);

        if withdrawal.approvals.len() >= withdrawal.required {
            execute(&env, &mut family, &mut withdrawal)?;
            Ok(true)
        } else {
            save_withdrawal(&env, &withdrawal);
            Ok(false)
        }
    }

    /// Cancela un retiro pendiente (vencido o no): quien lo pidió o un guardián (K7).
    pub fn cancel_withdrawal(env: Env, caller: Address, withdrawal_id: u32) -> Result<(), Error> {
        caller.require_auth();
        let mut withdrawal = load_withdrawal(&env, withdrawal_id)?;
        if withdrawal.status != WithdrawalStatus::Pending {
            return Err(Error::WithdrawalNotPending);
        }
        let family = load_family(&env, withdrawal.family_id)?;
        let is_guardian = matches!(role_of(&family, &caller), Some(Role::Guardian));
        if caller != withdrawal.requested_by && !is_guardian {
            return Err(Error::NotAllowedToCancel);
        }
        withdrawal.status = WithdrawalStatus::Cancelled;
        save_withdrawal(&env, &withdrawal);
        remove_pending(&env, withdrawal.family_id, withdrawal_id);
        WithdrawalCancelled {
            family_id: withdrawal.family_id,
            withdrawal_id,
        }
        .publish(&env);
        Ok(())
    }

    // ─────────────────────────────  lecturas  ─────────────────────────────

    pub fn get_family(env: Env, family_id: u32) -> Result<Family, Error> {
        load_family(&env, family_id)
    }

    /// Ids de las familias de una dirección (para que la app encuentre la suya).
    pub fn families_of(env: Env, address: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::FamiliesOf(address))
            .unwrap_or(Vec::new(&env))
    }

    /// Total que una dirección depositó en la bóveda de una familia.
    pub fn contribution_of(env: Env, family_id: u32, address: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(family_id, address))
            .unwrap_or(0)
    }

    pub fn get_withdrawal(env: Env, withdrawal_id: u32) -> Result<Withdrawal, Error> {
        load_withdrawal(&env, withdrawal_id)
    }

    /// Retiros pendientes de una familia (los más viejos primero).
    pub fn pending_withdrawals(env: Env, family_id: u32) -> Vec<Withdrawal> {
        let mut out = Vec::new(&env);
        for id in pending_ids(&env, family_id).iter() {
            if let Ok(w) = load_withdrawal(&env, id) {
                out.push_back(w);
            }
        }
        out
    }

    /// SAC del USDC que guarda la bóveda.
    pub fn usdc(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Usdc).unwrap()
    }

    /// Reemplaza el código del contrato conservando sus datos. Solo el admin.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// ─────────────────────────────  ayudantes  ─────────────────────────────

fn usdc(env: &Env) -> TokenClient<'_> {
    let address: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
    TokenClient::new(env, &address)
}

fn load_family(env: &Env, family_id: u32) -> Result<Family, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Family(family_id))
        .ok_or(Error::FamilyNotFound)
}

fn save_family(env: &Env, family: &Family) {
    let key = DataKey::Family(family.id);
    env.storage().persistent().set(&key, family);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn load_withdrawal(env: &Env, withdrawal_id: u32) -> Result<Withdrawal, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Withdrawal(withdrawal_id))
        .ok_or(Error::WithdrawalNotFound)
}

fn save_withdrawal(env: &Env, withdrawal: &Withdrawal) {
    let key = DataKey::Withdrawal(withdrawal.id);
    env.storage().persistent().set(&key, withdrawal);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn position_of(family: &Family, address: &Address) -> Option<u32> {
    family
        .members
        .iter()
        .position(|m| m.address == *address)
        .map(|i| i as u32)
}

fn role_of(family: &Family, address: &Address) -> Option<Role> {
    family
        .members
        .iter()
        .find(|m| m.address == *address)
        .map(|m| m.role)
}

fn require_guardian(family: &Family, address: &Address) -> Result<(), Error> {
    match role_of(family, address) {
        Some(Role::Guardian) => Ok(()),
        Some(Role::Member) => Err(Error::NotGuardian),
        None => Err(Error::NotMember),
    }
}

fn require_core(family: &Family, address: &Address) -> Result<(), Error> {
    if family.core == *address {
        Ok(())
    } else {
        Err(Error::NotCore)
    }
}

/// Guardianes que pueden aprobar un retiro de `requester` (todos menos él).
fn eligible_approvers(family: &Family, requester: &Address) -> u32 {
    family
        .members
        .iter()
        .filter(|m| m.role == Role::Guardian && m.address != *requester)
        .count() as u32
}

fn is_expired(env: &Env, withdrawal: &Withdrawal) -> bool {
    env.ledger().timestamp() > withdrawal.created_at + WITHDRAWAL_TTL_SECS
}

/// Transfiere el retiro al destino y lo marca ejecutado.
fn execute(env: &Env, family: &mut Family, withdrawal: &mut Withdrawal) -> Result<(), Error> {
    if withdrawal.amount > family.balance {
        return Err(Error::InsufficientBalance);
    }
    usdc(env).transfer(
        &env.current_contract_address(),
        &withdrawal.to,
        &withdrawal.amount,
    );
    family.balance -= withdrawal.amount;
    withdrawal.status = WithdrawalStatus::Executed;
    save_family(env, family);
    save_withdrawal(env, withdrawal);
    remove_pending(env, withdrawal.family_id, withdrawal.id);
    WithdrawalExecuted {
        family_id: withdrawal.family_id,
        withdrawal_id: withdrawal.id,
        to: withdrawal.to.clone(),
        amount: withdrawal.amount,
    }
    .publish(env);
    Ok(())
}

fn link_family(env: &Env, address: &Address, family_id: u32) -> Result<(), Error> {
    let key = DataKey::FamiliesOf(address.clone());
    let storage = env.storage().persistent();
    let mut ids: Vec<u32> = storage.get(&key).unwrap_or(Vec::new(env));
    if ids.len() >= MAX_FAMILIES_PER_ADDRESS {
        return Err(Error::TooManyFamilies);
    }
    ids.push_back(family_id);
    storage.set(&key, &ids);
    storage.extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(())
}

fn unlink_family(env: &Env, address: &Address, family_id: u32) {
    let key = DataKey::FamiliesOf(address.clone());
    let storage = env.storage().persistent();
    let ids: Vec<u32> = storage.get(&key).unwrap_or(Vec::new(env));
    if let Some(i) = ids.first_index_of(family_id) {
        let mut ids = ids;
        ids.remove(i);
        storage.set(&key, &ids);
        storage.extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

fn pending_ids(env: &Env, family_id: u32) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::Pending(family_id))
        .unwrap_or(Vec::new(env))
}

fn save_pending(env: &Env, family_id: u32, ids: &Vec<u32>) {
    let key = DataKey::Pending(family_id);
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn remove_pending(env: &Env, family_id: u32, withdrawal_id: u32) {
    let mut ids = pending_ids(env, family_id);
    if let Some(i) = ids.first_index_of(withdrawal_id) {
        ids.remove(i);
        save_pending(env, family_id, &ids);
    }
}

mod test;
