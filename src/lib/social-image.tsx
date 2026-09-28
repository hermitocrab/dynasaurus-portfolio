import { ImageResponse } from "next/og";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageAlt = "DynaSaurus — personalized AI language tutor";

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 82px",
          color: "#F7F7FA",
          background:
            "radial-gradient(circle at 85% 10%, rgba(167,139,250,.45), transparent 35%), radial-gradient(circle at 10% 90%, rgba(45,212,191,.3), transparent 38%), linear-gradient(135deg, #0A0A0C 0%, #17101D 55%, #0D0D0F 100%)",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <div
            style={{
              width: "78px",
              height: "78px",
              borderRadius: "22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#170E0D",
              background: "linear-gradient(135deg, #FF6B6B, #FFB347)",
              fontSize: "42px",
              fontWeight: 900,
            }}
          >
            D
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "54px", fontWeight: 900, letterSpacing: "-2px" }}>DynaSaurus</div>
            <div style={{ color: "#B9B7C2", fontSize: "24px" }}>词灵龙 · By Kee Lee</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "920px" }}>
          <div style={{ fontSize: "62px", lineHeight: 1.05, fontWeight: 900, letterSpacing: "-2.5px" }}>
            Personalized AI language learning
          </div>
          <div style={{ color: "#C6C4CE", fontSize: "28px", lineHeight: 1.35 }}>
            Vocabulary · Translation · Grammar feedback · IELTS speaking
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            {["Recognise", "Understand", "Apply"].map((step) => (
              <div
                key={step}
                style={{
                  border: "1px solid rgba(255,255,255,.18)",
                  borderRadius: "999px",
                  padding: "10px 18px",
                  color: "#E6E4EB",
                  fontSize: "18px",
                }}
              >
                {step}
              </div>
            ))}
          </div>
          <div style={{ color: "#8F8C99", fontSize: "18px" }}>dynasaurus.rkrk.io</div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
