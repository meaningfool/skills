import {
  getBoundaryWrapperKind,
  unwrapExpression,
} from "../shared.mjs";

export const requireSchemaForOwnedBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require ownedDecoder(...) to receive an explicit schema capability before conversion.",
    },
    messages: {
      schemaRequired:
        "ownedDecoder(...) requires a schema-backed validator as its first argument. Pass a schema with parse(input) before converting validated data.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (getBoundaryWrapperKind(node.callee, context) !== "owned-decoder") {
          return;
        }

        const schema = unwrapExpression(node.arguments?.[0]);

        if (!isSchemaCapability(schema)) {
          context.report({
            node: schema ?? node,
            messageId: "schemaRequired",
          });
        }
      },
    };
  },
};

function isSchemaCapability(node) {
  if (node === null || node === undefined) {
    return false;
  }

  if (node.type === "Identifier") {
    return node.name !== "undefined";
  }

  if (node.type === "MemberExpression" || node.type === "CallExpression") {
    return true;
  }

  if (node.type === "ObjectExpression") {
    return node.properties.some((property) => {
      if (property.type !== "Property" && property.type !== "MethodDefinition") {
        return false;
      }

      const key = property.key;
      return (
        ((key?.type === "Identifier" && key.name === "parse") ||
          (key?.type === "Literal" && key.value === "parse")) &&
        (property.method ||
          property.value?.type === "FunctionExpression" ||
          property.value?.type === "ArrowFunctionExpression")
      );
    });
  }

  if (node.type === "ConditionalExpression") {
    return isSchemaCapability(node.consequent) && isSchemaCapability(node.alternate);
  }

  return false;
}
