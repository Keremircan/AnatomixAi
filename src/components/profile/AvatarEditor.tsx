"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";
import { AuthError, removeAvatar, uploadAvatar, type UserProfile } from "@/lib/auth";
import { AVATAR_ACCEPT, AvatarImageError, prepareAvatar } from "@/lib/avatarImage";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

/**
 * Profil fotoğrafı: üzerine gelince "Fotoğrafı değiştir" katmanı belirir. Seçilen görsel tarayıcıda
 * kırpılıp küçültülür ve önizlenir; kullanıcı "Kaydet" demeden sunucuya gönderilmez.
 */
export function AvatarEditor({ user, onChange }: { user: UserProfile; onChange: (avatarUrl: string | null) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<"prepare" | "upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Önizleme adresi bellekte sızıntı bırakmasın.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview.url)), [preview]);

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""; // aynı dosya yeniden seçilebilsin
    if (!file) return;
    setError(null);
    setBusy("prepare");
    try {
      const blob = await prepareAvatar(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof AvatarImageError ? e.message : "Görsel hazırlanamadı.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy("upload");
    setError(null);
    try {
      onChange(await uploadAvatar(preview.blob));
      setPreview(null);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Fotoğraf yüklenemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      await removeAvatar();
      onChange(null);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Fotoğraf kaldırılamadı.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-center">
      <div className="group relative">
        <UserAvatar user={user} src={preview?.url} size={88} className={cn("rounded-2xl", preview && "ring-2 ring-accent ring-offset-2 ring-offset-surface")} textClassName="text-2xl tracking-tight" />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-background/70 text-[11px] font-medium text-foreground backdrop-blur-sm transition",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          {busy === "prepare" || busy === "upload" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          <span className="text-center leading-tight">{busy === "upload" ? "Yükleniyor" : user.avatarUrl ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            disabled={!!busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {preview ? (
        <div className="flex items-center gap-1.5 animate-rise">
          <button
            type="button"
            onClick={save}
            disabled={!!busy}
            className="h-7 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-accent-foreground transition hover:bg-accent-strong disabled:opacity-60"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={!!busy}
            aria-label="Önizlemeyi iptal et"
            className="grid size-7 place-items-center rounded-lg border border-line text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        user.avatarUrl && (
          <button type="button" onClick={remove} disabled={!!busy} className="text-[11px] text-muted underline-offset-2 transition hover:text-danger hover:underline disabled:opacity-60">
            {busy === "remove" ? "Kaldırılıyor…" : "Fotoğrafı kaldır"}
          </button>
        )
      )}

      {error && (
        <p role="alert" className="max-w-40 text-[11px] leading-snug text-danger">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {preview ? "Yeni fotoğraf önizleniyor. Kaydetmek için Kaydet düğmesine basın." : ""}
      </p>
    </div>
  );
}
