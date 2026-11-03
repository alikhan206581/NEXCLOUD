
"use client";

import { useEffect, useState } from "react";
import { Cloud, Folder, Users, HardDrive } from "lucide-react";

const stats = [
  {
    title: "Total Storage",
    target: 2.4,
    suffix: " TB",
    decimals: 1,
    detail: "Out of 5 TB available",
    icon: Cloud,
  },
  {
    title: "Total Files",
    target: 12458,
    suffix: "",
    decimals: 0,
    detail: "Files stored",
    icon: Folder,
  },
  {
    title: "Team Members",
    target: 24,
    suffix: "",
    decimals: 0,
    detail: "Active members",
    icon: Users,
  },
  {
    title: "Storage Used",
    target: 48,
    suffix: "%",
    decimals: 0,
    detail: "2.4 TB consumed",
    icon: HardDrive,
  },
];

function AnimatedCounter({ target, suffix, decimals }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const duration = 1800;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);

      setCount(target * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    const frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      {count.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}

export default function DashboardStats() {
  return (
    <div className="stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <Icon size={21} />
            </div>

            <h2>
              <AnimatedCounter
                target={stat.target}
                suffix={stat.suffix}
                decimals={stat.decimals}
              />
            </h2>

            <p>{stat.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
