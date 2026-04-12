import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

type AppIconProps = LucideProps & {
  icon: LucideIcon;
};

export function AppIcon({
  icon: Icon,
  strokeWidth = 1.85,
  ...props
}: AppIconProps) {
  return <Icon aria-hidden="true" strokeWidth={strokeWidth} {...props} />;
}

type IconOrbProps = ComponentPropsWithoutRef<"span"> & {
  icon: LucideIcon;
};

export function IconOrb({ className, icon, ...props }: IconOrbProps) {
  return (
    <span className={["icon-orb", className].filter(Boolean).join(" ")} {...props}>
      <AppIcon className="h-4 w-4" icon={icon} />
    </span>
  );
}
