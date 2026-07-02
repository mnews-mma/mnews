import { SITE_URL } from "@/lib/seo";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: Props) {
  return (
    <nav aria-label="パンくずリスト" className="breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, i) => (
          <li key={i} className="breadcrumb-item">
            {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
            {item.href && i < items.length - 1 ? (
              <a href={item.href} className="breadcrumb-link">{item.label}</a>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** JSON-LD BreadcrumbList を生成 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
      .filter((item) => item.href)
      .map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        item: `${SITE_URL}${item.href}`,
      })),
  };
}
