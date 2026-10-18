#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    Address, Env, Event as _,
    testutils::{Address as _, Events as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
};

const NOW: u64 = 1_700_000_000;
const DAY: u64 = 24 * 60 * 60;
/// 1 USDC con 7 decimales.
const USDC: i128 = 10_000_000;

struct Setup {
    env: Env,
    client: FamilyVaultClient<'static>,
    token: TokenClient<'static>,
    minter: StellarAssetClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(NOW);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let admin = Address::generate(&env);
    let id = env.register(FamilyVault, (admin, sac.address()));
    Setup {
        client: FamilyVaultClient::new(&env, &id),
        token: TokenClient::new(&env, &sac.address()),
        minter: StellarAssetClient::new(&env, &sac.address()),
        env,
    }
}

/// Dirección con `usdc` USDC.
fn funded(s: &Setup, usdc: i128) -> Address {
    let a = Address::generate(&s.env);
    if usdc > 0 {
        s.minter.mint(&a, &(usdc * USDC));
    }
    a
}

#[test]
fn creates_a_family_with_its_core() {
    let s = setup();
    let core = Address::generate(&s.env);
    let id = s.client.create_family(&core);

    assert_eq!(
        s.env.events().all(),
        std::vec![
            FamilyCreated {
                family_id: id,
                core: core.clone()
            }
            .to_xdr(&s.env, &s.client.address)
        ]
    );
    assert_eq!(s.env.auths()[0].0, core);
    let family = s.client.get_family(&id);
    assert_eq!(family.core, core);
    assert_eq!(family.members.len(), 1);
    assert_eq!(family.members.get(0).unwrap().role, Role::Guardian);
    assert_eq!(family.approvals_needed, 1);
    assert_eq!(s.client.families_of(&core), soroban_sdk::vec![&s.env, id]);
    assert_eq!(s.client.try_get_family(&99), Err(Ok(Error::FamilyNotFound)));
}

#[test]
fn k6_members_and_roles() {
    let s = setup();
    let core = Address::generate(&s.env);
    let mom = Address::generate(&s.env);
    let grandma = Address::generate(&s.env);
    let id = s.client.create_family(&core);

    s.client.add_member(&core, &id, &mom, &Role::Guardian);
    s.client.add_member(&mom, &id, &grandma, &Role::Member);
    assert_eq!(s.client.get_family(&id).members.len(), 3);
    assert_eq!(
        s.client.families_of(&grandma),
        soroban_sdk::vec![&s.env, id]
    );

    // Repetida, miembro que agrega, guardián (no núcleo) que nombra guardianes.
    assert_eq!(
        s.client.try_add_member(&core, &id, &mom, &Role::Member),
        Err(Ok(Error::AlreadyMember))
    );
    let cousin = Address::generate(&s.env);
    assert_eq!(
        s.client
            .try_add_member(&grandma, &id, &cousin, &Role::Member),
        Err(Ok(Error::NotGuardian))
    );
    assert_eq!(
        s.client.try_add_member(&mom, &id, &cousin, &Role::Guardian),
        Err(Ok(Error::NotCore))
    );
    assert_eq!(
        s.client
            .try_add_member(&cousin, &id, &cousin, &Role::Member),
        Err(Ok(Error::NotMember))
    );

    // Solo el núcleo cambia roles; el núcleo no cambia ni sale ni se quita.
    assert_eq!(
        s.client.try_set_role(&mom, &id, &grandma, &Role::Guardian),
        Err(Ok(Error::NotCore))
    );
    assert_eq!(
        s.client.try_set_role(&core, &id, &core, &Role::Member),
        Err(Ok(Error::CoreIsFixed))
    );
    assert_eq!(
        s.client.try_leave_family(&core, &id),
        Err(Ok(Error::CoreIsFixed))
    );
    assert_eq!(
        s.client.try_remove_member(&mom, &id, &core),
        Err(Ok(Error::CoreIsFixed))
    );

    // Un guardián (no núcleo) no quita a otro guardián; el núcleo sí.
    s.client.set_role(&core, &id, &grandma, &Role::Guardian);
    assert_eq!(
        s.client.try_remove_member(&mom, &id, &grandma),
        Err(Ok(Error::NotCore))
    );
    s.client.remove_member(&core, &id, &grandma);
    assert_eq!(s.client.families_of(&grandma).len(), 0);

    // Salirse.
    s.client.leave_family(&mom, &id);
    assert_eq!(s.client.get_family(&id).members.len(), 1);
    assert_eq!(
        s.client.try_leave_family(&mom, &id),
        Err(Ok(Error::NotMember))
    );
}

#[test]
fn k6_caps_family_size_and_families_per_address() {
    let s = setup();
    let core = Address::generate(&s.env);
    let id = s.client.create_family(&core);
    for _ in 1..MAX_MEMBERS {
        s.client
            .add_member(&core, &id, &Address::generate(&s.env), &Role::Member);
    }
    assert_eq!(
        s.client
            .try_add_member(&core, &id, &Address::generate(&s.env), &Role::Member),
        Err(Ok(Error::FamilyFull))
    );

    let busy = Address::generate(&s.env);
    for _ in 0..MAX_FAMILIES_PER_ADDRESS {
        s.client.create_family(&busy);
    }
    assert_eq!(
        s.client.try_create_family(&busy),
        Err(Ok(Error::TooManyFamilies))
    );
}

#[test]
fn k3_deposits_go_to_the_vault() {
    let s = setup();
    let core = funded(&s, 100);
    let stranger = funded(&s, 100);
    let id = s.client.create_family(&core);

    s.client.deposit(&core, &id, &(40 * USDC));
    s.client.deposit(&core, &id, &(10 * USDC));
    assert_eq!(s.env.auths()[0].0, core);

    let family = s.client.get_family(&id);
    assert_eq!(family.balance, 50 * USDC);
    assert_eq!(s.client.contribution_of(&id, &core), 50 * USDC);
    assert_eq!(s.token.balance(&s.client.address), 50 * USDC);
    assert_eq!(s.token.balance(&core), 50 * USDC);

    assert_eq!(
        s.client.try_deposit(&stranger, &id, &USDC),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        s.client.try_deposit(&core, &id, &0),
        Err(Ok(Error::InvalidAmount))
    );

    s.client.set_goal(&core, &id, &(500 * USDC));
    assert_eq!(s.client.get_family(&id).goal, 500 * USDC);
    assert_eq!(
        s.client.try_set_goal(&core, &id, &-1),
        Err(Ok(Error::InvalidGoal))
    );
}

#[test]
fn k4_k5_withdrawal_needs_another_guardian() {
    let s = setup();
    let core = funded(&s, 100);
    let grandma = funded(&s, 0);
    let id = s.client.create_family(&core);
    s.client.add_member(&core, &id, &grandma, &Role::Member);
    s.client.deposit(&core, &id, &(100 * USDC));

    // K5: el destino es de la familia.
    let scammer = Address::generate(&s.env);
    assert_eq!(
        s.client
            .try_request_withdrawal(&grandma, &id, &scammer, &USDC),
        Err(Ok(Error::DestinationNotMember))
    );
    assert_eq!(
        s.client
            .try_request_withdrawal(&grandma, &id, &grandma, &(101 * USDC)),
        Err(Ok(Error::InsufficientBalance))
    );

    // La abuela pide; el núcleo aprueba y se ejecuta.
    let wid = s
        .client
        .request_withdrawal(&grandma, &id, &grandma, &(30 * USDC));
    let pending = s.client.pending_withdrawals(&id);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending.get(0).unwrap().required, 1);
    assert_eq!(s.token.balance(&grandma), 0);

    assert_eq!(
        s.client.try_approve_withdrawal(&grandma, &wid),
        Err(Ok(Error::NotGuardian))
    );
    assert!(s.client.approve_withdrawal(&core, &wid));
    // events().all() trae solo los de la última llamada (el SAC también emite el suyo).
    let events = s.env.events().all();
    let executed = WithdrawalExecuted {
        family_id: id,
        withdrawal_id: wid,
        to: grandma.clone(),
        amount: 30 * USDC,
    }
    .to_xdr(&s.env, &s.client.address);
    assert!(std::format!("{events:?}").contains(&std::format!("{executed:?}")));

    assert_eq!(s.token.balance(&grandma), 30 * USDC);
    assert_eq!(s.client.get_family(&id).balance, 70 * USDC);
    assert_eq!(
        s.client.get_withdrawal(&wid).status,
        WithdrawalStatus::Executed
    );
    assert_eq!(s.client.pending_withdrawals(&id).len(), 0);
    assert_eq!(
        s.client.try_approve_withdrawal(&core, &wid),
        Err(Ok(Error::WithdrawalNotPending))
    );
}

#[test]
fn k4_core_alone_withdraws_directly_but_not_with_another_guardian() {
    let s = setup();
    let core = funded(&s, 50);
    let id = s.client.create_family(&core);
    s.client.deposit(&core, &id, &(50 * USDC));

    // Único guardián: se ejecuta en el acto.
    let first = s.client.request_withdrawal(&core, &id, &core, &(10 * USDC));
    assert_eq!(
        s.client.get_withdrawal(&first).status,
        WithdrawalStatus::Executed
    );
    assert_eq!(s.token.balance(&core), 10 * USDC);

    // Con otro guardián, el núcleo también necesita su aprobación.
    let mom = Address::generate(&s.env);
    s.client.add_member(&core, &id, &mom, &Role::Guardian);
    let second = s.client.request_withdrawal(&core, &id, &core, &(10 * USDC));
    assert_eq!(
        s.client.get_withdrawal(&second).status,
        WithdrawalStatus::Pending
    );
    assert_eq!(
        s.client.try_approve_withdrawal(&core, &second),
        Err(Ok(Error::SelfApproval))
    );
    assert!(s.client.approve_withdrawal(&mom, &second));
    assert_eq!(s.token.balance(&core), 20 * USDC);
}

#[test]
fn d5_approvals_needed_is_capped_by_eligible_guardians() {
    let s = setup();
    let core = funded(&s, 100);
    let mom = Address::generate(&s.env);
    let dad = Address::generate(&s.env);
    let kid = Address::generate(&s.env);
    let id = s.client.create_family(&core);
    s.client.add_member(&core, &id, &mom, &Role::Guardian);
    s.client.add_member(&core, &id, &dad, &Role::Guardian);
    s.client.add_member(&core, &id, &kid, &Role::Member);
    s.client.deposit(&core, &id, &(100 * USDC));

    assert_eq!(
        s.client.try_set_approvals(&mom, &id, &2),
        Err(Ok(Error::NotCore))
    );
    assert_eq!(
        s.client.try_set_approvals(&core, &id, &0),
        Err(Ok(Error::InvalidApprovals))
    );
    s.client.set_approvals(&core, &id, &2);

    // El hijo pide: lo aprueban dos guardianes.
    let w = s.client.request_withdrawal(&kid, &id, &kid, &(5 * USDC));
    assert!(!s.client.approve_withdrawal(&mom, &w));
    assert_eq!(
        s.client.try_approve_withdrawal(&mom, &w),
        Err(Ok(Error::AlreadyApproved))
    );
    assert!(s.client.approve_withdrawal(&dad, &w));
    assert_eq!(s.token.balance(&kid), 5 * USDC);

    // Con 5 pedidas pero 2 guardianes posibles, se piden 2.
    s.client.set_approvals(&core, &id, &5);
    let w2 = s.client.request_withdrawal(&mom, &id, &mom, &USDC);
    assert_eq!(s.client.get_withdrawal(&w2).required, 2);
}

#[test]
fn k7_withdrawals_expire_and_can_be_cancelled() {
    let s = setup();
    let core = funded(&s, 20);
    let kid = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);
    let id = s.client.create_family(&core);
    s.client.add_member(&core, &id, &kid, &Role::Member);
    s.client.deposit(&core, &id, &(20 * USDC));

    let w = s.client.request_withdrawal(&kid, &id, &kid, &USDC);
    s.env.ledger().set_timestamp(NOW + 8 * DAY);
    assert_eq!(
        s.client.try_approve_withdrawal(&core, &w),
        Err(Ok(Error::WithdrawalExpired))
    );
    assert_eq!(
        s.client.try_cancel_withdrawal(&stranger, &w),
        Err(Ok(Error::NotAllowedToCancel))
    );
    s.client.cancel_withdrawal(&kid, &w);
    assert_eq!(
        s.client.get_withdrawal(&w).status,
        WithdrawalStatus::Cancelled
    );
    assert_eq!(s.client.pending_withdrawals(&id).len(), 0);
    assert_eq!(s.client.get_family(&id).balance, 20 * USDC);
    assert_eq!(
        s.client.try_cancel_withdrawal(&core, &w),
        Err(Ok(Error::WithdrawalNotPending))
    );

    // K7: tope de pendientes.
    for _ in 0..MAX_PENDING {
        s.client.request_withdrawal(&kid, &id, &kid, &USDC);
    }
    assert_eq!(
        s.client.try_request_withdrawal(&kid, &id, &kid, &USDC),
        Err(Ok(Error::TooManyPending))
    );
}

#[test]
fn k4_execution_rechecks_the_vault_balance() {
    let s = setup();
    let core = funded(&s, 10);
    let kid = Address::generate(&s.env);
    let id = s.client.create_family(&core);
    s.client.add_member(&core, &id, &kid, &Role::Member);
    s.client.deposit(&core, &id, &(10 * USDC));

    // Dos pedidos que juntos superan la bóveda: el segundo ya no alcanza.
    let a = s.client.request_withdrawal(&kid, &id, &kid, &(8 * USDC));
    let b = s.client.request_withdrawal(&kid, &id, &kid, &(8 * USDC));
    s.client.approve_withdrawal(&core, &a);
    assert_eq!(
        s.client.try_approve_withdrawal(&core, &b),
        Err(Ok(Error::InsufficientBalance))
    );
    assert_eq!(s.client.get_family(&id).balance, 2 * USDC);
    assert_eq!(s.token.balance(&s.client.address), 2 * USDC);
}
