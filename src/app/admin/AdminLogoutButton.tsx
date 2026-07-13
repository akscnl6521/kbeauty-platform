"use client";

export function AdminLogoutButton({
  className,
  label = "로그아웃",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action="/admin/logout" method="post">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
