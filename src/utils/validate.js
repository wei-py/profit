export function isNumeric(val) {
  if (val === '' || val === null || val === undefined)
    return false
  return !Number.isNaN(Number(val))
}

export function isEmpty(val) {
  return val === '' || val === null || val === undefined
}

export function isValidOptionValue(group, value) {
  if (!group || !group.items)
    return true
  return group.items.some(item => String(item.itemValue) === String(value))
}

export function validatePreset(preset) {
  const errs = []
  if (!preset.presetName)
    errs.push('预设名称不能为空')
  if (!preset.ruleSetId)
    errs.push('规则集不能为空')
  if (!preset.cpId)
    errs.push('国家平台不能为空')
  return errs
}

export function validatePresetParam(param) {
  const errs = []
  if (!param.paramName)
    errs.push('参数名称不能为空')
  if (!param.fieldKey)
    errs.push('字段键不能为空')
  return errs
}

export function validateOptionGroup(group) {
  const errs = []
  if (!group.groupName)
    errs.push('分组名称不能为空')
  return errs
}

export function validateOptionItem(item) {
  const errs = []
  if (isEmpty(item.itemValue) && item.itemValue !== 0)
    errs.push('值不能为空')
  return errs
}

export function validateUserInputs(inputs, fields) {
  const errs = []
  for (const field of fields) {
    const label = field.fieldName || field.paramName || field.fieldKey
    if (field.required && isEmpty(inputs[field.fieldKey])) {
      errs.push(`${label} 不能为空`)
    }
    if (field.type === 'number' && !isEmpty(inputs[field.fieldKey]) && !isNumeric(inputs[field.fieldKey])) {
      errs.push(`${label} 必须是数字`)
    }
  }
  return errs
}
