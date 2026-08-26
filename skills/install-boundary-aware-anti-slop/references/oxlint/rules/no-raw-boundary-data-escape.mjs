import {
  collectReturnStatements,
  containsDirectParameterValue,
  getBoundaryHelperNames,
  getBoundaryCallback,
  getBoundaryWrapperKind,
  getFunctionReturnType,
  getParameterName,
  isOpenExpression,
  isOpenType,
  isUnknownParameter,
  unwrapExpression,
} from "../shared.mjs";

export const noRawBoundaryDataEscapeRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent raw provider values and open output types from escaping declared boundaries.",
    },
    messages: {
      rawEscape:
        "Raw boundary data escapes from this {{kind}}. Return a narrow owned value; tolerantAdapter(...) must use success(ownedValue) or failure(code, message).",
      openOutput:
        "This {{kind}} returns an open `unknown`/dictionary shape. Validate or map the boundary value to a named owned contract before returning it.",
      adapterResult:
        "A tolerantAdapter(...) callback must return success(ownedValue) or failure(code, message), never raw provider data.",
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
        const kind = getBoundaryWrapperKind(node.callee, context);

        if (kind === null) {
          return;
        }

        const callback = getBoundaryCallback(node, context, kind);

        if (callback === null) {
          return;
        }

        const callbackKind = kind === "owned-decoder" ? "owned decoder" : "tolerant adapter";
        const returnType = getFunctionReturnType(callback);

        if (isOpenType(returnType, typeAliases)) {
          context.report({
            node: returnType,
            messageId: "openOutput",
            data: { kind: callbackKind },
          });
        }

        const rawParameterNames = new Set(
          kind === "tolerant-adapter" && callback.params[0]
            ? [getParameterName(callback.params[0], context.sourceCode)]
            : [],
        );
        const openOwnedParameterNames = new Set(
          kind === "owned-decoder"
            ? callback.params
                .filter(isUnknownParameter)
                .map((parameter) => getParameterName(parameter, context.sourceCode))
            : [],
        );

        const helperNames = getBoundaryHelperNames(context);

        for (const returned of collectReturnStatements(callback)) {
          const expression = returned.argument ?? returned.expression ?? returned;

          if (kind === "tolerant-adapter") {
            checkAdapterReturn(
              expression,
              rawParameterNames,
              helperNames,
              typeAliases,
              context,
              returned,
            );
          } else if (
            containsDirectParameterValue(expression, openOwnedParameterNames) ||
            isOpenExpression(expression, typeAliases)
          ) {
            context.report({
              node: expression,
              messageId: "openOutput",
              data: { kind: callbackKind },
            });
          }
        }
      },
    };
  },
};

function checkAdapterReturn(
  expression,
  rawParameterNames,
  helperNames,
  typeAliases,
  context,
  node,
) {
  const value = unwrapExpression(expression);

  if (value === null) {
    context.report({ node, messageId: "adapterResult" });
    return;
  }

  if (value.type === "CallExpression") {
    const helperName = getStaticName(value.callee);

    if (helperNames.failure.includes(helperName)) {
      return;
    }

    if (helperNames.success.includes(helperName)) {
      const output = value.arguments?.[0];

      if (
        output === undefined ||
        containsDirectParameterValue(output, rawParameterNames) ||
        isOpenExpression(output, typeAliases)
      ) {
        context.report({ node: output ?? value, messageId: "rawEscape", data: { kind: "tolerant adapter" } });
      }

      return;
    }
  }

  context.report({ node: value, messageId: "adapterResult" });
}

function getStaticName(node) {
  const expression = unwrapExpression(node);

  if (expression?.type === "Identifier") {
    return expression.name;
  }

  if (
    expression?.type === "MemberExpression" &&
    expression.computed === false &&
    expression.property?.type === "Identifier"
  ) {
    return expression.property.name;
  }

  return null;
}
