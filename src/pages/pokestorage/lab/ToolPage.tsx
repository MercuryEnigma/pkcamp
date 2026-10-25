import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { OptionGroup } from '../../hub/OptionGroup'
import { Panel } from '../../hub/Panel'
import './toolPage.css'

/**
 * The layout shared by the three research tools: a toggle between the tool's
 * two options on top, the choices on the left and the GB-Link task on the
 * right. On phones the choices stack above the task.
 */
export function ToolPage<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  choices,
  task,
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  choices: ReactNode
  task: ReactNode
}) {
  const { t } = useTranslation(['lab', 'common'] as const)

  return (
    <div className="tool-page">
      <OptionGroup
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="tool-columns">
        <Panel label={t('ToolPage.choices')}>{choices}</Panel>
        <Panel label={t('ToolPage.task')}>{task}</Panel>
      </div>
    </div>
  )
}
