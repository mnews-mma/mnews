import { SocialPost } from "@/lib/feeds/youtube";
import { X_PROFILES } from "@/lib/social";
import { relativeTimeJa } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";

export default function SocialSection({ videos }: { videos: SocialPost[] }) {
  if (videos.length === 0 && X_PROFILES.length === 0) return null;

  return (
    <div className="home-section">
      <div className="fighter-section-head">
        <div style={{ fontFamily: "var(--os)", fontSize: 16, fontWeight: 600, color: "var(--text)", letterSpacing: 1 }}>
          公式SNS最新発信
        </div>
      </div>

      {videos.length > 0 && (
        <div className="social-grid">
          {videos.map((v) => (
            <a key={v.videoId} href={v.url} target="_blank" rel="noopener noreferrer" className="social-card">
              <div className="social-thumb-wrap">
                <img src={v.thumbnail} alt={v.title} className="social-thumb" loading="lazy" />
                <span className="social-play">▶</span>
              </div>
              <div className="social-body">
                <span
                  className="social-org"
                  style={{ color: SOURCES[v.org].color, borderColor: SOURCES[v.org].color }}
                >
                  {v.orgLabel} · YouTube
                </span>
                <div className="social-title">{v.title}</div>
                <div className="social-time">{relativeTimeJa(v.publishedAt)}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {X_PROFILES.length > 0 && (
        <div className="social-x-links">
          <span className="social-x-label">公式Xを見る:</span>
          {X_PROFILES.map((p) => (
            <a
              key={p.org}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-x-link"
              style={{ color: SOURCES[p.org].color, borderColor: SOURCES[p.org].color }}
            >
              {p.orgLabel}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
