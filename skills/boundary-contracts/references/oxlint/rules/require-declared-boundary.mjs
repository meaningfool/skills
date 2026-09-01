import {
  getParameterAnnotation,
  getParameterName,
  isBoundaryCallbackParameter,
  isFunctionNode,
  isOpenType,
} from "../shared.mjs";

const functionVisitors = {
  ArrowFunctionExpression: checkFunction,
  FunctionDeclaration: checkFunction,
  FunctionExpression: checkFunction,
};

export const requireDeclaredBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require suspicious use of open runtime input to be moved into a boundary declaration.",
    },
    messages: {
      rawInputParameter:
        "Parameter `{{parameter}}` handles open runtime data outside a declared boundary. Improve the internal type, move validation to the real ingress, or use boundary({...}) or boundary.tolerant({...}).",
    },
  },
  create(context) {
    return Object.fromEntries(
      Object.keys(functionVisitors).map((nodeType) => [
        nodeType,
        (node) => checkFunction(node, context),
      ]),
    );
  },
};

function checkFunction(node, context) {
  for (const parameter of node.params ?? []) {
    if (!isOpenType(getParameterAnnotation(parameter)?.typeAnnotation)) {
      continue;
    }

    const parameterName = getParameterName(parameter, context.sourceCode);

    if (
      isBoundaryCallbackParameter(node, parameter, context) ||
      !functionBodyReferences(node, parameterName)
    ) {
      continue;
    }

    context.report({
      node: parameter.typeAnnotation?.typeAnnotation ?? parameter,
      messageId: "rawInputParameter",
      data: { parameter: parameterName },
    });
  }
}

function functionBodyReferences(functionNode, parameterName) {
  let found = false;
  visit(functionNode.body, functionNode);
  return found;

  function visit(node, rootFunction) {
    if (found || node === null || typeof node !== "object") return;
    if (node !== rootFunction.body && isFunctionNode(node)) return;
    if (node.type === "Identifier" && node.name === parameterName) {
      found = true;
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "parent" || key === "tokens" || key === "comments" || key === "loc") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const child of value) visit(child, rootFunction);
      } else {
        visit(value, rootFunction);
      }
    }
  }
}
