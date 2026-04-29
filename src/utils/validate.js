/**
 * 判断值是否为数字。
 * @param {*} val - 待检查的值
 * @returns {boolean} 是否为数字
 */
export function isNumeric(val) {
  if (val === '' || val === null || val === undefined)
    return false
  return !Number.isNaN(Number(val))
}

/**
 * 判断值是否为空（undefined / null / 空字符串）。
 * @param {*} val - 待检查的值
 * @returns {boolean} 是否为空
 */
export function isEmpty(val) {
  return val === '' || val === null || val === undefined
}

/**
 * 验证选项值在分组中是否有效。
 * @param {{ items: Array }} group - 选项分组对象
 * @param {*} value - 待验证的值
 * @returns {boolean} 是否有效
 */
export function isValidOptionValue(group, value) {
  if (!group || !group.items)
    return true
  return group.items.some(item => String(item.itemValue) === String(value))
}

/**
 * 验证预设对象的基本字段。
 * @param {{ presetName: string, ruleSetId: string, cpId: string }} preset - 预设对象
 * @returns {string[]} 错误信息列表
 */
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

/**
 * 验证预设参数对象的基本字段。
 * @param {{ paramName: string, fieldKey: string }} param - 参数对象
 * @returns {string[]} 错误信息列表
 */
export function validatePresetParam(param) {
  const errs = []
  if (!param.paramName)
    errs.push('参数名称不能为空')
  if (!param.fieldKey)
    errs.push('字段键不能为空')
  return errs
}

/**
 * 验证选项分组对象的基本字段。
 * @param {{ groupName: string }} group - 分组对象
 * @returns {string[]} 错误信息列表
 */
export function validateOptionGroup(group) {
  const errs = []
  if (!group.groupName)
    errs.push('分组名称不能为空')
  return errs
}

/**
 * 验证选项项对象的值不能为空。
 * @param {{ itemValue: * }} item - 选项项对象
 * @returns {string[]} 错误信息列表
 */
export function validateOptionItem(item) {
  const errs = []
  if (isEmpty(item.itemValue) && item.itemValue !== 0)
    errs.push('值不能为空')
  return errs
}

/**
 * 校验用户输入是否满足字段的必填与类型要求。
 * @param {object} inputs - 用户输入键值对
 * @param {Array} fields - 字段定义列表
 * @returns {string[]} 错误信息列表
 */
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
