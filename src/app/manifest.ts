import type { MetadataRoute } from "next";

/**
 * Web uygulaması bildirimi (PWA): ana ekrana eklendiğinde ANATOMIX.AI tarayıcı çubuğu olmadan, kendi simgesi
 * ve açılış rengiyle ayrı bir uygulama gibi açılır. Tarayıcı bu dosyayı çerezsiz ister; proxy bu yolu korumaz.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ANATOMIX.AI · Klinik ön triyaj",
    short_name: "ANATOMIX",
    description: "Şikayetinizi 3B anatomi modelinde işaretleyin; yapay zekâ destekli ön triyaj ve poliklinik yönlendirmesi alın.",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#060b12",
    theme_color: "#060b12",
    categories: ["health", "medical", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Yeni şikayet", short_name: "Şikayet", url: "/#sikayet", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Profilim", url: "/profile", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
