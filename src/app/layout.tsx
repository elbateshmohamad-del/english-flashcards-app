import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EnglishForge - 英語学習プラットフォーム",
  description: "5,000語を9ヶ月で完全マスター。複利型学習システムとAI応用テストで、使える英語力を手に入れよう。",
  keywords: ["英語学習", "フラッシュカード", "単語帳", "英単語", "spaced repetition"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <div className="bg-gradient" />
        {children}
      </body>
    </html>
  );
}
