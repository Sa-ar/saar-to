const APEX_ORIGIN = "https://saar.to";

const TYPEOF_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "undefined",
  "function",
  "symbol",
  "bigint",
]);

const DIRECTIVES = new Set(["use client", "use server", "use strict"]);

const JSX_VALUE_ATTRS = new Set(["value", "defaultValue"]);

const DISCRIMINANT_KEYS = new Set([
  "kind",
  "target",
  "role",
  "status",
  "disposition",
  "fileSource",
  "source",
  "filter",
  "pane",
  "layout",
  "platform",
  "env",
]);

function isTokenString(value) {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 32 &&
    /^[A-Za-z][A-Za-z0-9_-]*$/.test(value) &&
    !TYPEOF_TYPES.has(value) &&
    !DIRECTIVES.has(value)
  );
}

function ancestors(node) {
  const chain = [];
  for (let current = node.parent; current; current = current.parent) {
    chain.push(current);
  }
  return chain;
}

function isTypeofCheck(node) {
  const parent = node.parent;
  if (parent?.type !== "BinaryExpression") {
    return false;
  }
  const other = parent.left === node ? parent.right : parent.left;
  return other?.type === "UnaryExpression" && other.operator === "typeof";
}

function isAsConstValue(node) {
  return ancestors(node).some(
    (parent) =>
      parent.type === "TSAsExpression" ||
      parent.type === "TSTypeAssertion" ||
      parent.type === "TSSatisfiesExpression",
  );
}

function isJsxAllowedAttr(node) {
  const parent = node.parent;
  if (!parent) {
    return false;
  }
  if (parent.type === "JSXAttribute") {
    const name = parent.name?.name;
    return typeof name === "string" && !JSX_VALUE_ATTRS.has(name);
  }
  if (parent.type === "JSXExpressionContainer") {
    const attr = parent.parent;
    if (attr?.type === "JSXAttribute") {
      const name = attr.name?.name;
      return typeof name === "string" && !JSX_VALUE_ATTRS.has(name);
    }
  }
  return parent.type === "JSXText";
}

function isMongoOperatorKey(node) {
  return typeof node.value === "string" && node.value.startsWith("$");
}

function isPropertyKey(node) {
  const parent = node.parent;
  return parent?.type === "Property" && parent.key === node;
}

function isComparisonOrCase(node) {
  const parent = node.parent;
  if (!parent) {
    return false;
  }
  if (parent.type === "SwitchCase" && parent.test === node) {
    return true;
  }
  if (parent.type === "BinaryExpression" && ["===", "!==", "==", "!="].includes(parent.operator)) {
    return true;
  }
  return false;
}

function propertyKeyName(property) {
  if (property.key.type === "Identifier") {
    return property.key.name;
  }
  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }
  return null;
}

function isDiscriminantProperty(node) {
  const parent = node.parent;
  if (parent?.type !== "Property" || parent.value !== node || parent.computed) {
    return false;
  }
  return DISCRIMINANT_KEYS.has(propertyKeyName(parent));
}

function isTokenEnumArray(node) {
  const parent = node.parent;
  if (parent?.type !== "ArrayExpression") {
    return false;
  }
  const elements = parent.elements.filter(Boolean);
  if (elements.length < 2) {
    return false;
  }
  return elements.every((element) => element.type === "Literal" && isTokenString(element.value));
}

const noMagicToken = {
  create(context) {
    return {
      Literal(node) {
        if (!isTokenString(node.value) || isMongoOperatorKey(node) || isPropertyKey(node)) {
          return;
        }
        if (isTypeofCheck(node) || isAsConstValue(node) || isJsxAllowedAttr(node)) {
          return;
        }
        if (!isComparisonOrCase(node) && !isDiscriminantProperty(node) && !isTokenEnumArray(node)) {
          return;
        }

        context.report({
          node,
          message:
            "Use a named const object or enum instead of a magic string. Define the value once with `as const` and reference it.",
        });
      },
    };
  },
};

const noHardcodedApex = {
  create(context) {
    return {
      Literal(node) {
        if (node.value === APEX_ORIGIN) {
          context.report({
            node,
            message:
              "Use APEX_ORIGIN or getBaseUrl() from @/lib/urls instead of a hardcoded apex origin.",
          });
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
    "no-magic-token": noMagicToken,
    "no-hardcoded-apex": noHardcodedApex,
  },
};

export default plugin;
