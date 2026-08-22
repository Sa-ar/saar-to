const KIND_VALUES = new Map([
  ["path", "Use SHORT_URL_KIND.PATH from @/lib/kinds instead of a magic kind string."],
  ["subdomain", "Use SHORT_URL_KIND.SUBDOMAIN from @/lib/kinds instead of a magic kind string."],
  ["both", "Use SHORT_URL_KIND.BOTH from @/lib/kinds instead of a magic kind string."],
]);

const noMagicKind = {
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") {
          return;
        }

        const message = KIND_VALUES.get(node.value);
        if (message) {
          context.report({ node, message });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "saar-to",
  },
  rules: {
    "no-magic-kind": noMagicKind,
  },
};

export default plugin;
