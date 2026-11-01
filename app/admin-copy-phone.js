"use client";

import { useState } from "react";

export default function AdminCopyPhone({ phone }) {
  const [status, setStatus] = useState("");

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phone);
      setStatus("Copied");
      window.setTimeout(() => setStatus(""), 1800);
    } catch {
      setStatus("Copy failed");
    }
  }

  return (
    <span className="admin-seller-phone">
      <a href={`tel:${phone}`}>{phone}</a>
      <button
        className="admin-copy-phone"
        type="button"
        onClick={copyPhone}
        aria-label={`Copy seller phone number ${phone}`}
      >
        {status || "Copy"}
      </button>
    </span>
  );
}
