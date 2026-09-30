import { useEffect } from 'react'
import { useSettings } from '@rhyme/hooks/queries'
import { useTheme } from '@rhyme/ui/components/theme'

export function AccountPreferences({
  children,
}: {
  children: React.ReactNode
}) {
  const { data } = useSettings()
  const { setTheme } = useTheme()
  const theme = data?.theme
  useEffect(() => {
    if (theme) setTheme(theme)
  }, [theme, setTheme])
  return children
}
