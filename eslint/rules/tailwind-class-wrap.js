export default {
  meta: {
    docs: {
      description: "Auto wrap tailwind classes",
    },

    fixable: "whitespace",

    schema: [
      {
        additionalProperties: false,

        properties: {
          perLine: {
            type: "number",
          },
        },

        type: "object",
      },
    ],

    type: "layout",
  },

  create(context) {
    const defineTemplateBodyVisitor = context.parserServices?.defineTemplateBodyVisitor;

    // 非 Vue 文件直接跳过
    if (!defineTemplateBodyVisitor) {
      return {};
    }

    const perLine = context.options[0]?.perLine || 5;

    return defineTemplateBodyVisitor({
      VAttribute(node) {
        if (node.key.name !== "class" || !node.value || !node.value.value) {
          return;
        }

        const classText = node.value.value.trim();

        if (!classText)
          return;

        const classes = classText.split(/\s+/).filter(Boolean);

        if (classes.length <= perLine)
          return;

        const groups = [];

        for (let i = 0; i < classes.length; i += perLine) {
          groups.push(classes.slice(i, i + perLine).join(" "));
        }

        const indent = " ".repeat(node.loc.start.column);

        const newValue = `"\\n${groups
          .map(line => `${indent}  ${line}`)
          .join("\\n")}\\n${indent}"`;

        context.report({
          message: `Class names should wrap every ${perLine} items.`,

          node,

          fix(fixer) {
            return fixer.replaceText(node.value, newValue);
          },
        });
      },
    });
  },
};
