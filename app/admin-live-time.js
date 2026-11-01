"use client";

import { useEffect, useState } from "react";

function getTimeLabel(date) {
  const hour = Number(new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    hour12: false,
    timeZone: "Africa/Accra",
  }).format(date));

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(date);
}

export default function AdminLiveTime({ username }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const interval = window.setInterval(updateTime, 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <h1>{now ? getTimeLabel(now) : "Welcome"}, <em>{username}.</em></h1>
      <time className="dashboard-date" dateTime={now?.toISOString()}>
        {now ? formatDateTime(now) : "Loading current time..."}
      </time>
    </>
  );
}
