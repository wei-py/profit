// eslint.config.js
// 使用 @antfu/eslint-config 作为基础配置（由 Anthony Fu 提供的现代、强约定的 ESLint 配置）
import antfu from "@antfu/eslint-config";
// import tailwindClassWrap from "./eslint/rules/tailwind-class-wrap.js";

export default antfu({
  // 启用对非 JavaScript 文件的格式化支持
  formatters: {
    css: true, // 格式化 .css 文件
    html: true, // 格式化 .html 文件
    jsonc: true, // 格式化 .json / .jsonc（带注释）文件
    markdown: false, // 暂不格式化 .md 文件（可按需开启）
  },

  // 忽略特定文件或目录，ESLint 将不对这些路径进行检查
  ignores: [
    "**/.kilo/**",
    "**/src-tauri/target/**",
    "**/deprecated/**",
    "**/*/uni_modules/**/*", // uni-app 插件模块（通常为第三方）
    "uni_modules/**/*",
    "main.js", // 主入口文件（可能含平台兼容代码）
    "wxcomponents/**/*", // 微信小程序原生组件（非 Vue 管理）
    "unpackage/**/*", // uni-app 构建产物目录
    "uniCloud-aliyun/**/*", // uniCloud 云函数目录
    "utils/css.js", // 特殊 CSS 工具文件（可能含非标准语法）
    "types/global.d.ts", // 全局类型声明（TS 文件，由 tsc/TS 插件处理）
    "manifest.json", // 应用配置清单（JSON 格式，通常由平台读取）
    "node_modules/**/*", // 第三方依赖（永远忽略）
    "uni.promisify.adaptor.js", // uni API Promisify 适配器（平台兼容层）
    "pages.json", // uni-app 页面路由配置
    "css.js", // 可能是动态生成的样式模块
    "androidPrivacy.json", // Android 隐私清单（平台专用）
    "md.md", // 示例或临时 markdown 文件
    ".hbuilderx/**/*", // HBuilderX IDE 配置
    ".vscode/**/*", // VS Code 项目配置
    ".qoder/**/*", // Qoder（可能为内部工具）配置目录
  ],

  // 定义全局变量（避免未定义变量报错）
  languageOptions: {
    globals: {
      getApp: "readonly", // uni-app 全局函数，获取 App 实例
      getCurrentPages: "readonly", // uni-app 全局函数，获取页面栈
      plus: "readable",
      program: "readonly",
      uni: "readonly", // uni-app 核心 API 对象
    },
  },

  // 自定义 ESLint 规则覆盖
  rules: {
    // 禁用强制使用 === / !==（因 uni 平台部分 API 返回类型不一致，放宽限制）
    "eqeqeq": ["off"],

    // JSDoc 块注释规范：多行 JSDoc 必须为多行格式（即不能写成 /** 内容 */ 单行）
    "jsdoc/multiline-blocks": ["error", { noMultilineBlocks: true, noSingleLineBlocks: false }],

    // 强制 JSON 对象的键按字母顺序排序（提升可读性和 diff 友好性）
    "jsonc/sort-keys": "error",

    // 限制单行最大长度为 100 字符（字符串和 URL 不计入）
    "max-len": [
      "off",
      // { code: 100, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true },
    ],

    // 允许使用 console（开发阶段调试需要，可配合构建工具移除）
    "no-console": ["off"],

    // 自动对 import 语句按字母顺序排序（提升一致性）
    "perfectionist/sort-imports": "error",

    // 自动对对象字面量的键按字母排序
    "perfectionist/sort-objects": [
      "error",
      {
        groups: [
          "property", // 非函数属性（包括单行/多行）
          "method", // 函数类型的属性（方法）
        ],
        order: "asc",
        type: "alphabetical",
      },
    ],

    "prefer-promise-reject-errors": ["off"],

    // 允许使用 tab 缩进（与 stylistic 中的空格偏好可能冲突，此处显式关闭该规则）
    "style/no-tabs": ["off"],

    // Vue 属性命名：禁止使用连字符（如 <MyComponent my-prop /> 应写为 myProp）
    "vue/attribute-hyphenation": ["error", "never"],

    // "tailwindcss/classnames-order": "error",

    // Vue 模板属性排序规则
    "vue/attributes-order": [
      "error",
      {
        alphabetical: true, // 在每个分组内部按字母升序排列
        order: [
          "CONDITIONALS", // v-if, v-else-if, v-else, v-show
          "TWO_WAY_BINDING", // v-model
          "EVENTS", // @tap、@input 等事件监听器
          "DEFINITION", // is（动态组件）
          "LIST_RENDERING", // v-for
          "RENDER_MODIFIERS", // v-once, v-pre
          "GLOBAL", // id 属性
          "UNIQUE", // ref, key, slot, scoped-slot
          "OTHER_DIRECTIVES", // 其他自定义指令（如 v-loading）
          "OTHER_ATTR", // 普通属性及绑定，如 :disabled、type、color
          "CONTENT", // v-text, v-html
        ],
      },
    ],

    // 在 Vue 单文件组件中也强制使用驼峰命名（如 props、data 属性）
    // "vue/camelcase": ["error", { properties: "always" }],

    // 在 Vue 文件中同样关闭 === 强制要求
    "vue/eqeqeq": ["off"],

    // Vue 模板中属性值必须使用双引号
    "vue/html-quotes": ["error", "double", { avoidEscape: false }],

    // 每行最多一个属性（提高可读性，便于 git diff）
    "vue/max-attributes-per-line": [
      "error",
      {
        multiline: { max: 1 }, // 多行标签每行最多一个属性
        singleline: { max: 3 }, // 单行标签也限制为一个属性（强制换行）
      },
    ],

    // 关闭对 Vue prop 类型必须使用构造函数（如 String 而非 'String'）的校验
    "vue/require-prop-type-constructor": ["off"],

    // 强制使用驼峰命名（对象属性名也需驼峰）
    // "camelcase": ["error", { properties: "always" }],
    "vue/singleline-html-element-content-newline": "off",

    // 强制静态 class 名按字母排序（如 class="btn primary" → class="primary btn"）
    // "vue/static-class-names-order": ["error"],
    // 关闭 v-slot 语法校验（可能因旧写法或特殊场景需要）
    "vue/valid-v-slot": ["off"],

    // 注释掉的规则：可临时关闭 Vue 模板解析错误检查（不建议长期关闭）
    // "vue/no-parsing-error": ["off"],
  },

  // 代码风格偏好（影响格式化行为）
  stylistic: {
    arrowParens: true, // 箭头函数单参数也加括号：(x) => {}
    quotes: "double", // 使用双引号
    semi: true, // 语句末尾加分号
  },

  // 启用 Vue 相关规则（包括 .vue 文件解析、模板规则等）
  vue: true,
});
