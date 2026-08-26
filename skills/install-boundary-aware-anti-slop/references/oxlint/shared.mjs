const defaultWrapperNames = Object.freeze({
  ownedDecoder: Object.freeze(["ownedDecoder"]),
  tolerantAdapter: Object.freeze(["tolerantAdapter"]),
});

const defaultHelperNames = Object.freeze({
  success: Object.freeze(["success"]),
  failure: Object.freeze(["failure"]),
});

const functionNodeTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

export function getBoundaryWrapperKind(callee, context) {
  const name = getStaticName(callee);

  if (name === null) {
    return null;
  }

  const names = getWrapperNames(context);

  if (names.ownedDecoder.includes(name)) {
    return "owned-decoder";
  }

  if (names.tolerantAdapter.includes(name)) {
    return "tolerant-adapter";
  }

  return null;
}

export function getBoundaryCallback(call, context, kind) {
  if (getBoundaryWrapperKind(call.callee, context) !== kind) {
    return null;
  }

  const callbackIndex = kind === "owned-decoder" ? 1 : 0;
  const callback = unwrapExpression(call.arguments?.[callbackIndex]);

  return isFunctionNode(callback) ? callback : null;
}

export function isDirectBoundaryCallback(node, context) {
  let current = node.parent;

  while (current !== null && isExpressionWrapper(current)) {
    current = current.parent;
  }

  if (current?.type !== "CallExpression") {
    return false;
  }

  const kind = getBoundaryWrapperKind(current.callee, context);

  if (kind === null) {
    return false;
  }

  const callbackIndex = kind === "owned-decoder" ? 1 : 0;
  return unwrapExpression(current.arguments?.[callbackIndex]) === node;
}

export function isBoundaryCallbackParameter(node, parameter, context) {
  return isDirectBoundaryCallback(node, context) && node.params?.[0] === parameter;
}

export function getWrapperNames(context) {
  const configured = context.settings?.["boundary-contracts"] ?? {};

  return {
    ownedDecoder: readNames(configured.ownedDecoderNames, defaultWrapperNames.ownedDecoder),
    tolerantAdapter: readNames(
      configured.tolerantAdapterNames,
      defaultWrapperNames.tolerantAdapter,
    ),
  };
}

export function getBoundaryHelperNames(context) {
  const configured = context.settings?.["boundary-contracts"] ?? {};

  return {
    success: readNames(configured.successNames, defaultHelperNames.success),
    failure: readNames(configured.failureNames, defaultHelperNames.failure),
  };
}

export function getStaticName(node) {
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

export function unwrapExpression(node) {
  let current = node ?? null;

  while (
    current !== null &&
    (current.type === "ChainExpression" ||
      current.type === "ParenthesizedExpression" ||
      current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSInstantiationExpression" ||
      current.type === "TSSatisfiesExpression")
  ) {
    current = current.expression;
  }

  return current;
}

export function isFunctionNode(node) {
  return node !== null && functionNodeTypes.has(node.type);
}

export function isUnknownParameter(parameter) {
  const annotation = getParameterAnnotation(parameter);
  return annotation?.typeAnnotation?.type === "TSUnknownKeyword";
}

export function getParameterAnnotation(parameter) {
  if (parameter === null || parameter === undefined) {
    return null;
  }

  if (parameter.type === "TSParameterProperty") {
    return getParameterAnnotation(parameter.parameter);
  }

  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? getParameterAnnotation(parameter.argument);
  }

  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? getParameterAnnotation(parameter.left);
  }

  return parameter.typeAnnotation ?? null;
}

export function getParameterName(parameter, sourceCode) {
  if (parameter?.type === "TSParameterProperty") {
    return getParameterName(parameter.parameter, sourceCode);
  }

  if (parameter?.type === "AssignmentPattern") {
    return getParameterName(parameter.left, sourceCode);
  }

  if (parameter?.type === "RestElement") {
    return getParameterName(parameter.argument, sourceCode);
  }

  if (parameter?.type === "Identifier") {
    return parameter.name;
  }

  return sourceCode.getText(parameter).replace(/\s*:\s*unknown\s*$/u, "");
}

export function getFunctionReturnType(node) {
  return node.returnType?.typeAnnotation ?? null;
}

export function collectReturnStatements(functionNode) {
  const returns = [];
  const seen = new Set();

  if (functionNode.body?.type !== "BlockStatement") {
    return functionNode.body === undefined ? returns : [{ expression: functionNode.body }];
  }

  visit(functionNode.body, functionNode, returns, seen);
  return returns;
}

function visit(node, rootFunction, returns, seen) {
  if (node === null || typeof node !== "object" || seen.has(node)) {
    return;
  }

  seen.add(node);

  if (node.type === "ReturnStatement") {
    returns.push(node);
    return;
  }

  if (node !== rootFunction && isFunctionNode(node)) {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "tokens" || key === "comments" || key === "loc") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child, rootFunction, returns, seen);
      }
    } else {
      visit(value, rootFunction, returns, seen);
    }
  }
}

export function containsDirectParameterValue(node, parameterNames) {
  const expression = unwrapExpression(node);

  if (expression === null) {
    return false;
  }

  if (expression.type === "Identifier") {
    return parameterNames.has(expression.name);
  }

  if (expression.type === "SpreadElement") {
    return containsDirectParameterValue(expression.argument, parameterNames);
  }

  if (
    expression.type === "ObjectExpression" ||
    expression.type === "ArrayExpression"
  ) {
    return expression.elements?.some((element) =>
      containsDirectParameterValue(element, parameterNames),
    ) ?? expression.properties?.some((property) =>
      containsDirectParameterValue(property, parameterNames),
    );
  }

  if (expression.type === "Property") {
    return containsDirectParameterValue(expression.value, parameterNames);
  }

  if (expression.type === "AssignmentProperty") {
    return containsDirectParameterValue(expression.value, parameterNames);
  }

  if (expression.type === "ConditionalExpression") {
    return (
      containsDirectParameterValue(expression.consequent, parameterNames) ||
      containsDirectParameterValue(expression.alternate, parameterNames)
    );
  }

  if (expression.type === "LogicalExpression") {
    return (
      containsDirectParameterValue(expression.left, parameterNames) ||
      containsDirectParameterValue(expression.right, parameterNames)
    );
  }

  if (expression.type === "CallExpression") {
    const calleeName = getStaticName(expression.callee);

    if (calleeName === "assign" && expression.arguments.length > 1) {
      return expression.arguments.slice(1).some((argument) =>
        containsDirectParameterValue(argument, parameterNames),
      );
    }
  }

  return false;
}

export function isOpenType(node, aliases = new Map(), resolving = new Set()) {
  const type = unwrapType(node);

  if (type === null) {
    return false;
  }

  if (
    type.type === "TSAnyKeyword" ||
    type.type === "TSUnknownKeyword" ||
    type.type === "TSObjectKeyword"
  ) {
    return true;
  }

  if (type.type === "TSUnionType" || type.type === "TSIntersectionType") {
    return type.types.some((member) => isOpenType(member, aliases, resolving));
  }

  if (type.type === "TSTypeReference") {
    const name = getStaticTypeName(type.typeName);

    if (name === "Record" && type.typeArguments?.params.length === 2) {
      return isOpenDictionaryValue(type.typeArguments.params[1], aliases, resolving);
    }

    if (name === "Readonly" && type.typeArguments?.params.length === 1) {
      return isOpenType(type.typeArguments.params[0], aliases, resolving);
    }

    if (
      (name === "AdapterResult" || name === "Array" || name === "ReadonlyArray") &&
      type.typeArguments?.params.length === 1
    ) {
      return isOpenType(type.typeArguments.params[0], aliases, resolving);
    }

    if (name !== null && aliases.has(name) && !resolving.has(name)) {
      const nextResolving = new Set(resolving);
      nextResolving.add(name);
      return isOpenType(aliases.get(name), aliases, nextResolving);
    }

    return false;
  }

  if (type.type === "TSTypeLiteral") {
    if (type.members.length === 0) {
      return true;
    }

    return type.members.some((member) => {
      if (member.type !== "TSIndexSignature") {
        return false;
      }

      return isOpenDictionaryValue(
        member.typeAnnotation?.typeAnnotation,
        aliases,
        resolving,
      );
    });
  }

  if (type.type === "TSMappedType") {
    return isOpenType(type.typeAnnotation, aliases, resolving);
  }

  return false;
}

export function isOpenExpression(node, aliases = new Map()) {
  const expression = node ?? null;

  if (expression === null) {
    return false;
  }

  if (
    expression.type === "TSAsExpression" ||
    expression.type === "TSTypeAssertion" ||
    expression.type === "TSSatisfiesExpression"
  ) {
    return isOpenType(expression.typeAnnotation, aliases);
  }

  return false;
}

function isOpenDictionaryValue(node, aliases, resolving) {
  const type = unwrapType(node);

  if (type === null) {
    return false;
  }

  return (
    type.type === "TSAnyKeyword" ||
    type.type === "TSUnknownKeyword" ||
    type.type === "TSObjectKeyword" ||
    isOpenType(type, aliases, resolving)
  );
}

function unwrapType(node) {
  let current = node ?? null;

  while (
    current !== null &&
    (current.type === "TSParenthesizedType" || current.type === "TSReadonlyType")
  ) {
    current = current.typeAnnotation ?? null;
  }

  return current;
}

function getStaticTypeName(node) {
  if (node?.type === "Identifier") {
    return node.name;
  }

  return null;
}

function readNames(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const names = value.filter((name) => typeof name === "string" && name.length > 0);
  return names.length === 0 ? fallback : names;
}

function isExpressionWrapper(node) {
  return (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSNonNullExpression" ||
    node.type === "ParenthesizedExpression" ||
    node.type === "ChainExpression" ||
    node.type === "TSInstantiationExpression" ||
    node.type === "TSSatisfiesExpression"
  );
}
