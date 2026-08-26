import {
  getParameterName,
  isBoundaryCallbackParameter,
  isUnknownParameter,
} from "../shared.mjs";

const functionVisitors = {
  ArrowFunctionExpression: checkFunction,
  FunctionDeclaration: checkFunction,
  FunctionExpression: checkFunction,
  TSCallSignatureDeclaration: checkFunction,
  TSConstructSignatureDeclaration: checkFunction,
  TSConstructorType: checkFunction,
  TSDeclareFunction: checkFunction,
  TSEmptyBodyFunctionExpression: checkFunction,
  TSFunctionType: checkFunction,
  TSMethodSignature: checkFunction,
};

export const requireDeclaredBoundaryRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require raw unknown parameters to be declared by an ownedDecoder(...) or tolerantAdapter(...) boundary.",
    },
    messages: {
      rawInputParameter:
        "Parameter `{{parameter}}` accepts raw `unknown` data outside a declared boundary. Use an ownedDecoder(schema, convert) or tolerantAdapter(adapt) callback, then pass a named domain value inward.",
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
    if (!isUnknownParameter(parameter)) {
      continue;
    }

    const parameterName = getParameterName(parameter, context.sourceCode);

    if (
      parameterName === "cause" ||
      isBoundaryCallbackParameter(node, parameter, context)
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
