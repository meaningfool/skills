import {
  collectReturnStatements,
  getFunctionReturnType,
  isOpenExpression,
  isOpenType,
  unwrapExpression,
} from "../shared.mjs";

export const noRawBoundaryDataEscapeRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent open results and assertion laundering from escaping boundary converters.",
    },
    messages: {
      inlineConverterRequired:
        "Keep boundary converters inline so their result can be checked for open output and assertion laundering.",
      openOutput:
        "This boundary converter returns an open value. Return a narrow owned contract without any, unknown, unrestricted records, or assertion laundering.",
    },
  },
  create(context) {
    let typeAliases = new Map();

    return {
      Program(node) {
        typeAliases = new Map(
          node.body
            .filter(
              (statement) =>
                statement.type === "TSTypeAliasDeclaration" &&
                statement.id?.type === "Identifier",
            )
            .map((statement) => [statement.id.name, statement.typeAnnotation]),
        );
      },
      CallExpression(node) {
        const strictConvert = getStrictConvert(node);
        if (strictConvert !== undefined && !isCallback(unwrapExpression(strictConvert))) {
          context.report({
            node: strictConvert ?? node,
            messageId: "inlineConverterRequired",
          });
          return;
        }
        for (const callback of getDescriptorCallbacks(node)) {
          checkConverter(callback, typeAliases, context);
        }
      },
    };
  },
};

function getStrictConvert(call) {
  const callee = unwrapExpression(call.callee);
  if (callee?.type !== "Identifier" || callee.name !== "boundary") return undefined;
  const descriptor = unwrapExpression(call.arguments?.[0]);
  if (descriptor?.type !== "ObjectExpression") return null;
  return propertyValue(descriptor, "convert");
}

function getDescriptorCallbacks(call) {
  const callee = unwrapExpression(call.callee);
  const descriptor = unwrapExpression(call.arguments?.[0]);
  if (descriptor?.type !== "ObjectExpression") return [];

  if (callee?.type === "Identifier" && callee.name === "boundary") {
    const convert = unwrapExpression(propertyValue(descriptor, "convert"));
    return isCallback(convert) ? [convert] : [];
  }

  if (!isTolerantCallee(callee)) return [];
  const variants = unwrapExpression(propertyValue(descriptor, "variants"));
  if (variants?.type !== "ArrayExpression") return [];
  return variants.elements.flatMap((element) => {
    const variant = unwrapExpression(element);
    if (variant?.type !== "ObjectExpression") return [];
    const convert = unwrapExpression(propertyValue(variant, "convert"));
    return isCallback(convert) ? [convert] : [];
  });
}

function checkConverter(callback, typeAliases, context) {
  const returnType = getFunctionReturnType(callback);
  if (isOpenType(returnType, typeAliases)) {
    context.report({ node: returnType, messageId: "openOutput" });
  }

  for (const returned of collectReturnStatements(callback)) {
    const expression = returned.argument ?? returned.expression ?? returned;
    if (containsOpenAssertion(expression, typeAliases)) {
      context.report({ node: expression, messageId: "openOutput" });
    }
  }
}

function containsOpenAssertion(node, aliases, seen = new Set()) {
  if (node === null || typeof node !== "object" || seen.has(node)) return false;
  seen.add(node);
  if (isOpenExpression(node, aliases)) return true;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "tokens" || key === "comments" || key === "loc") {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.some((child) => containsOpenAssertion(child, aliases, seen))) return true;
    } else if (containsOpenAssertion(value, aliases, seen)) {
      return true;
    }
  }
  return false;
}

function isTolerantCallee(callee) {
  return (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.object?.type === "Identifier" &&
    callee.object.name === "boundary" &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "tolerant"
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

function isCallback(node) {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}
