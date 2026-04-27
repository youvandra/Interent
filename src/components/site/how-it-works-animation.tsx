export function HowItWorksAnimation() {
  return (
    <div className="relative w-full bg-white">
      {/* SVG-only biar posisi & arrow presisi, tanpa kotak luar */}
      <svg
        className="w-full"
        viewBox="0 0 1000 420"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Interent flow diagram"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-foreground)" opacity="0.55" />
          </marker>
        </defs>

        {/* connectors (tegas) */}
        <path
          d="M270 95 L310 95 L310 175 L360 175"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="2.5"
          opacity="0.55"
          markerEnd="url(#arrow)"
        />
        <path
          d="M600 175 L650 175 L650 105 L700 105"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="2.5"
          opacity="0.55"
          markerEnd="url(#arrow)"
        />
        <path
          d="M820 140 L820 260"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="2.5"
          opacity="0.55"
          markerEnd="url(#arrow)"
        />
        <path
          d="M700 295 L640 295 L640 335 L500 335"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="2.5"
          opacity="0.55"
          markerEnd="url(#arrow)"
        />

        {/* Node helper */}
        {/* 1: Buyer Agent */}
        <rect x="60" y="60" width="210" height="70" fill="white" stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x="74" y="74" width="30" height="30" fill="var(--color-primary-soft)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="89" y="89" fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)">AI</text>
        <text x="116" y="90" fontSize="14" fontWeight="600" fill="var(--color-foreground)">Buyer Agent</text>
        <text x="116" y="108" fontSize="11" fill="var(--color-muted)">Pilih task + kirim input</text>

        {/* 2: Interent */}
        <rect x="360" y="140" width="240" height="70" fill="white" stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x="374" y="154" width="30" height="30" fill="var(--color-primary-soft)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="389" y="169" fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)">⧉</text>
        <text x="416" y="170" fontSize="14" fontWeight="600" fill="var(--color-foreground)">Interent</text>
        <text x="416" y="188" fontSize="11" fill="var(--color-muted)">Buat job + simpan input</text>

        {/* 3: Locus Checkout */}
        <rect x="700" y="70" width="240" height="70" fill="white" stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x="714" y="84" width="30" height="30" fill="var(--color-primary-soft)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="729" y="99" fontSize="14" fontWeight="800" textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)">$</text>
        <text x="756" y="100" fontSize="14" fontWeight="600" fill="var(--color-foreground)">Locus Checkout</text>
        <text x="756" y="118" fontSize="11" fill="var(--color-muted)">Buyer bayar USDC</text>

        {/* 4: Wrapped APIs */}
        <rect x="700" y="260" width="240" height="70" fill="white" stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x="714" y="274" width="30" height="30" fill="var(--color-primary-soft)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="729" y="289" fontSize="12" fontWeight="800" textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)">{`{}`}</text>
        <text x="756" y="290" fontSize="14" fontWeight="600" fill="var(--color-foreground)">Wrapped APIs</text>
        <text x="756" y="308" fontSize="11" fill="var(--color-muted)">DeepL / Mathpix / dll</text>

        {/* 5: Result */}
        <rect x="260" y="300" width="240" height="70" fill="white" stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x="274" y="314" width="30" height="30" fill="var(--color-primary-soft)" stroke="var(--color-border)" strokeWidth="1" />
        <text x="289" y="329" fontSize="14" fontWeight="800" textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)">✓</text>
        <text x="316" y="330" fontSize="14" fontWeight="600" fill="var(--color-foreground)">Result</text>
        <text x="316" y="348" fontSize="11" fill="var(--color-muted)">Siap diambil via API</text>
      </svg>
    </div>
  );
}
