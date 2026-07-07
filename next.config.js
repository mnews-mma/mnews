/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // 選手slug変更時の恒久リダイレクト(外部リンク・被リンク保護)。
  //   sudario-go → sudario-tsuyoshi: 「剛」の読みが「つよし」と判明したため
  //   (2026-07)。旧slugはここに追記し続け、削除しない。
  async redirects() {
    return [
      {
        source: "/fighters/sudario-go",
        destination: "/fighters/sudario-tsuyoshi",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
