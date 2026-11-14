import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:size-3',
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
