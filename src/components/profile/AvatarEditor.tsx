"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImageUp, LoaderCircle, X } from "lucide-react";
import { AuthError, removeAvatar, uploadAvatar, type UserProfile } from "@/lib/auth";
import { AVATAR_ACCEPT, AvatarImageError, prepareAvatar } from "@/lib/avatarImage";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

/**
 * Profil fotoğrafı: avatar kesikli çerçeveli bir yükleme alanıdır (tıklama veya sürükle-bırak); sağ alttaki kamera
 * rozeti ve altındaki düğme her zaman görünür. Seçilen görsel tarayıcıda kırpılıp küçültülür ve önizlenir;
 * kullanıcı "Kaydet" demeden sunucuya gönderilmez.
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

  const [dragging, setDragging] = useState(false);
  const hasPhoto = !!user.avatarUrl;
  const pick = () => inputRef.current?.click();

  return (
    <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-center">
      {/* Avatar: tıklanabilir ve sürükle-bırak hedefi. Kesikli çerçeve ve sağ alttaki kamera rozeti her zaman görünür. */}
      <div
        className="group relative"
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <label
          htmlFor={inputId}
          title={hasPhoto ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          className={cn(
            "block cursor-pointer rounded-[22px] border-2 border-dashed p-1 transition-colors duration-200",
            dragging ? "border-accent bg-accent/10" : preview ? "border-accent" : "border-accent/40 hover:border-accent group-focus-within:border-accent",
            busy && "cursor-progress",
          )}
        >
          <span className="relative block">
            <UserAvatar user={user} src={preview?.url} size={88} className="rounded-2xl" textClassName="text-2xl tracking-tight" />
            <span
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-background/70 text-[11px] font-medium text-foreground backdrop-blur-sm transition",
                busy || dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {busy === "prepare" || busy === "upload" ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <ImageUp className="size-5" aria-hidden />}
              <span className="text-center leading-tight">{busy === "upload" ? "Yükleniyor" : dragging ? "Bırakın" : hasPhoto ? "Değiştir" : "Yükle"}</span>
            </span>
          </span>
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
        {/* Her zaman görünen kamera rozeti */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_6px_16px_-6px_var(--accent)] ring-4 ring-surface transition-transform duration-200 group-hover:scale-110"
        >
          <Camera className="size-4" strokeWidth={2.2} />
        </span>
      </div>

      {preview ? (
        <div className="flex items-center gap-1.5 animate-rise">
          <button
            type="button"
            onClick={save}
            disabled={!!busy}
            className="h-8 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground transition hover:bg-accent-strong disabled:opacity-60"
          >
            Kaydet
          </button>
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={!!busy}
            aria-label="Önizlemeyi iptal et"
            className="grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="grid justify-items-start gap-1 sm:justify-items-center">
          <button
            type="button"
            onClick={pick}
            disabled={!!busy}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/8 px-3 text-xs font-medium text-accent transition hover:border-accent hover:bg-accent/15 disabled:opacity-60"
          >
            <Camera className="size-3.5" aria-hidden />
            {hasPhoto ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          </button>
          {hasPhoto && (
            <button type="button" onClick={remove} disabled={!!busy} className="text-[11px] text-muted underline-offset-2 transition hover:text-danger hover:underline disabled:opacity-60">
              {busy === "remove" ? "Kaldırılıyor…" : "Fotoğrafı kaldır"}
            </button>
          )}
        </div>
      )}
      <p className="max-w-44 text-[10px] leading-snug text-muted sm:text-center">JPG, PNG veya WebP · en fazla 2 MB. Görseli avatarın üzerine sürükleyip bırakabilirsiniz.</p>

      {error && (
        <p role="alert" className="max-w-44 text-[11px] leading-snug text-danger">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {preview ? "Yeni fotoğraf önizleniyor. Kaydetmek için Kaydet düğmesine basın." : ""}
      </p>
    </div>
  );
}
