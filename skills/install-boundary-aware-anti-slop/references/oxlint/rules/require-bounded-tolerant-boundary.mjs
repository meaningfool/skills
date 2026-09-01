import {
  getBoundaryHelperNames,
  getStaticName,
  unwrapExpression,
} from "../shared.mjs";

export const requireBoundedTolerantBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require boundary.tolerant(...) to name its source, enumerate schema-backed variants, and declare its fallback failure.",
    },
    messages: {
      boundedDescriptorRequired:
        "boundary.tolerant(...) requires a non-empty static source, one or more explicit schema-backed variants, and a failure(...) fallback.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isTolerantBoundaryCall(node)) return;
        const descriptor = unwrapExpression(node.arguments?.[0]);
        const helpers = getBoundaryHelperNames(context);
        if (!isBoundedDescriptor(descriptor, helpers.failure)) {
          context.report({
            node: descriptor ?? node,
            messageId: "boundedDescriptorRequired",
          });
        }
      },
    };
  },
};

function isTolerantBoundaryCall(node) {
  const callee = unwrapExpression(node.callee);
  return (
    callee?.type === "MemberExpression" &&
    callee.computed === false &&
    callee.object?.type === "Identifier" &&
    callee.object.name === "boundary" &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "tolerant"
  );
}

function isBoundedDescriptor(descriptor, failureNames) {
  if (descriptor?.type !== "ObjectExpression") return false;
  const source = propertyValue(descriptor, "source");
  const variants = propertyValue(descriptor, "variants");
  const otherwise = unwrapExpression(propertyValue(descriptor, "otherwise"));

  if (!isNonEmptyStaticString(source)) return false;
  if (variants?.type !== "ArrayExpression" || variants.elements.length === 0) {
    return false;
  }
  if (!variants.elements.every(isExplicitVariant)) return false;
  return (
    otherwise?.type === "CallExpression" &&
    failureNames.includes(getStaticName(otherwise.callee))
  );
}

function isExplicitVariant(node) {
  const variant = unwrapExpression(node);
  if (variant?.type !== "ObjectExpression") return false;
  const schema = propertyValue(variant, "schema");
  const convert = unwrapExpression(propertyValue(variant, "convert"));
  return (
    schema !== null &&
    (convert?.type === "ArrowFunctionExpression" ||
      convert?.type === "FunctionExpression")
  );
}

function isNonEmptyStaticString(node) {
  const value = unwrapExpression(node);
  if (value?.type === "Literal") {
    return typeof value.value === "string" && value.value.trim() !== "";
  }
  return (
    value?.type === "TemplateLiteral" &&
    value.expressions.length === 0 &&
    value.quasis[0]?.value?.cooked?.trim() !== ""
  );
}

function propertyValue(object, name) {
  const property = object.properties.find((candidate) =>
    candidate.type === "Property" &&
    !candidate.computed &&
    ((candidate.key.type === "Identifier" && candidate.key.name === name) ||
      (candidate.key.type === "Literal" && candidate.key.value === name)),
  );
  return property?.value ?? null;
}
