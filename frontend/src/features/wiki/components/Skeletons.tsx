import { Skeleton } from '@/shared/ui';

/** Mirrors the tree: indented rows of a chevron slot, an icon and a title. */
export function TreeSkeleton() {
  const rows = [0, 1, 1, 2, 0, 1, 0];
  return (
    <div className="flex flex-col gap-1 p-2" role="status" aria-busy>
      {rows.map((level, i) => (
        <div
          key={i}
          className="flex h-8 items-center gap-2"
          style={{ paddingLeft: 8 + level * 16 }}
        >
          <Skeleton className="size-4" />
          <Skeleton className="size-4" />
          <Skeleton className="h-3.5" style={{ width: `${48 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Mirrors the page header and an empty body. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-6" role="status" aria-busy>
      <Skeleton className="h-4 w-56" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-8 w-80" />
      </div>
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
