"use client";

import { useState } from "react";
import Image from "next/image";
import type { UserProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function initialsOf(user: Pick<UserProfile, "fullName" | "email">) {
  return (user.fullName || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

/**
 * Kullanıcı avatarı: profil fotoğrafı varsa onu, yoksa (veya yüklenemezse) baş harfleri gösterir.
 * Renk rolü yansıtır: hasta cyan, sağlık profesyoneli teal.
 */
export function UserAvatar({
  user,
  size,
  src,
  className,
  textClassName,
}: {
  user: Pick<UserProfile, "fullName" | "email" | "role" | "avatarUrl">;
  /** Piksel cinsinden kenar uzunluğu */
  size: number;
  /** Önizleme için avatarUrl yerine geçici adres (blob:) */
  src?: string;
  className?: string;
  textClassName?: string;
}) {
  const url = src ?? user.avatarUrl;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!url && failedUrl !== url;
  const tone = user.role === "clinician" ? "border-teal/40 bg-teal/12 text-teal" : "border-accent/40 bg-accent/12 text-accent";

  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden border font-semibold", tone, className)} style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          src={url}
          alt=""
          width={size}
          height={size}
          // Görsel kendi API'mizden, zaten 256×256 ve sürümlü adresle önbelleklenir; ek optimizasyona gerek yok.
          unoptimized
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span className={textClassName} aria-hidden>
          {initialsOf(user)}
        </span>
      )}
    </span>
  );
}
