import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Users,
} from "lucide-react";

type StatCardProps = {
  icon: "students" | "practical" | "submitted" | "pending";
  value: string | number;
  label: string;
  description: string;
};

const icons = {
  students: Users,
  practical: BookOpen,
  submitted: CheckCircle2,
  pending: Clock3,
};

export default function StatCard({
  icon,
  value,
  label,
  description,
}: StatCardProps) {
  const Icon = icons[icon];

  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">
          <Icon size={17} strokeWidth={1.7} />
        </div>

        <ArrowUpRight
          className="stat-arrow"
          size={16}
          strokeWidth={1.5}
        />
      </div>

      <div className="stat-card-value">{value}</div>

      <div className="stat-card-label">{label}</div>

      <div className="stat-card-description">{description}</div>
    </article>
  );
}
