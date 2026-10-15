"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { Avatar } from "@/components/user-menu";
import { COUNTRIES, flagOf } from "@/lib/countries";
import { useFormAction } from "@/lib/use-form-action";
import { confirmAction } from "@/lib/confirm";
import { removeAvatarAction, saveProfileAction, uploadAvatarAction } from "./actions";

const AVATAR_SIZE = 512;

/** Recorta al centro en cuadrado y reduce a 512 px WebP (pesa ~50–150 KB). */
async function prepareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/webp", 0.86),
  );
}

export function ProfileSection({
  email,
  profile,
}: {
  email: string;
  profile: {
    full_name: string | null;
    username: string | null;
    country: string | null;
    avatar_url: string | null;
    initials: string;
  };
}) {
  const { submit, pending, errors, message } = useFormAction(saveProfileAction, "Perfil guardado");
  const [name, setName] = useState(profile.full_name ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [uploading, startUpload] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    let blob: Blob;
    try {
      blob = await prepareAvatar(file);
    } catch {
      toast.error("No se pudo leer esa imagen. Prueba con una JPG o PNG.");
      return;
    }
    const local = URL.createObjectURL(blob);
    setPreview(local);
    const fd = new FormData();
    fd.set("avatar", new File([blob], "avatar.webp", { type: "image/webp" }));
    startUpload(async () => {
      const r = await uploadAvatarAction(fd);
      if (r?.ok) toast.success("Foto actualizada");
      else {
        setPreview(profile.avatar_url);
        toast.error((r && !r.ok && r.message) || "No se pudo subir la foto");
      }
    });
  }

  async function onRemove() {
    const ok = await confirmAction({
      title: "¿Quitar tu foto?",
      description: "Vuelven a mostrarse tus iniciales.",
      confirmLabel: "Quitar",
      tone: "danger",
      icon: "delete",
    });
    if (!ok) return;
    startUpload(async () => {
      const r = await removeAvatarAction();
      if (r?.ok) {
        setPreview(null);
        toast.success("Foto quitada");
      } else toast.error((r && !r.ok && r.message) || "No se pudo quitar la foto");
    });
  }

  return (
    <section className="surface flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          <Avatar
            account={{ avatarUrl: preview, initials: profile.initials }}
            className="size-24 text-2xl ring-4 ring-background"
          />
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white">
              <LoaderCircle className="size-6 animate-spin" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold tracking-tight">{name.trim() || "Tu perfil"}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Camera className="size-4" /> {preview ? "Cambiar foto" : "Subir foto"}
            </Button>
            {preview ? (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={onRemove}>
                <Trash2 className="size-4" /> Quitar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nombre" htmlFor="full_name" error={errors?.full_name} hint="Como quieres que te salude la app.">
          <Input
            id="full_name"
            name="full_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
            placeholder="Ej. Oswald Reid"
          />
        </FormField>
        <FormField
          label="Usuario"
          htmlFor="username"
          error={errors?.username}
          hint="Letras, números, punto o guion bajo."
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              name="username"
              defaultValue={profile.username ?? ""}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={31}
              placeholder="usuario"
              className="pl-7"
            />
          </div>
        </FormField>
        <FormField label="País" htmlFor="country" error={errors?.country}>
          <Select id="country" name="country" defaultValue={profile.country ?? ""}>
            <option value="">Sin indicar</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {flagOf(c.code)} {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Correo" htmlFor="email-readonly" hint="Se cambia en la sección Correo.">
          <Input id="email-readonly" value={email} readOnly disabled />
        </FormField>

        {message ? <p className="text-sm text-destructive sm:col-span-2">{message}</p> : null}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {pending ? "Guardando…" : "Guardar perfil"}
          </Button>
        </div>
      </form>
    </section>
  );
}
