import { useSpoilers } from '#/components/spoilers-provider'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { cn } from '#/lib/utils'

/** Compact Spoilers switch for the header nav / hamburger sheet. */
export function SpoilersToggle({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const { spoilers, setSpoilers } = useSpoilers()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Switch
        id={id}
        checked={spoilers}
        onCheckedChange={(checked) => setSpoilers(checked === true)}
        aria-label="Show match result spoilers"
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        Spoilers
      </Label>
    </div>
  )
}
