const functionNodeTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

export function getBoundaryHelperNames(context) {
  const configured = context.settings?.["boundary-contracts"] ?? {};
  return {
    failure: readNames(configured.failureNames, ["failure"]),
  };
}

export function getStaticName(node) {
  const expression = unwrapExpression(node);
  if (expression?.type === "Identifier") return expression.name;
  if (
    expression?.type === "MemberExpression" &&
    !expression.computed &&
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

export function getParameterAnnotation(parameter) {
  if (parameter === null || parameter === undefined) return null;
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
  if (parameter?.type === "Identifier") return parameter.name;
  return sourceCode.getText(parameter).replace(/\s*:\s*(?:unknown|any)\s*$/u, "");
}

export function isBoundaryCallbackParameter(node, parameter) {
  return node.params?.[0] === parameter && isDescriptorConverter(node);
}

function isDescriptorConverter(node) {
  const property = node.parent;
  if (
    property?.type !== "Property" ||
    property.computed ||
    property.key?.type !== "Identifier" ||
    property.key.name !== "convert"
  ) {
    return false;
  }

  const object = property.parent;
  if (object?.type !== "ObjectExpression") return false;
  const directCall = object.parent;
  if (
    directCall?.type === "CallExpression" &&
    unwrapExpression(directCall.arguments?.[0]) === object
  ) {
    const callee = unwrapExpression(directCall.callee);
    return callee?.type === "Identifier" && callee.name === "boundary";
  }

  const variants = object.parent;
  const variantsProperty = variants?.parent;
  const descriptor = variantsProperty?.parent;
  const tolerantCall = descriptor?.parent;
  if (
    variants?.type !== "ArrayExpression" ||
    variantsProperty?.type !== "Property" ||
    variantsProperty.computed ||
    variantsProperty.key?.type !== "Identifier" ||
    variantsProperty.key.name !== "variants" ||
    descriptor?.type !== "ObjectExpression" ||
    tolerantCall?.type !== "CallExpression" ||
    unwrapExpression(tolerantCall.arguments?.[0]) !== descriptor
  ) {
    return false;
  }
  const callee = unwrapExpression(tolerantCall.callee);
  return (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.object?.type === "Identifier" &&
    callee.object.name === "boundary" &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "tolerant"
  );
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
  if (node === null || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  if (node.type === "ReturnStatement") {
    returns.push(node);
    return;
  }
  if (node !== rootFunction && isFunctionNode(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "tokens" || key === "comments" || key === "loc") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child, rootFunction, returns, seen);
    } else {
      visit(value, rootFunction, returns, seen);
    }
  }
}

export function isOpenType(node, aliases = new Map(), resolving = new Set()) {
  const type = unwrapType(node);
  if (type === null) return false;
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
      return (
        isUnrestrictedRecordKey(type.typeArguments.params[0]) ||
        isOpenDictionaryValue(type.typeArguments.params[1], aliases, resolving)
      );
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
      const next = new Set(resolving);
      next.add(name);
      return isOpenType(aliases.get(name), aliases, next);
    }
    return false;
  }
  if (type.type === "TSTypeLiteral") {
    if (type.members.length === 0) return true;
    return type.members.some((member) => member.type === "TSIndexSignature");
  }
  if (type.type === "TSMappedType") {
    return isOpenType(type.typeAnnotation, aliases, resolving);
  }
  return false;
}

export function isOpenExpression(node, aliases = new Map()) {
  if (
    node?.type === "TSAsExpression" ||
    node?.type === "TSTypeAssertion" ||
    node?.type === "TSSatisfiesExpression"
  ) {
    return isOpenType(node.typeAnnotation, aliases);
  }
  return false;
}

function isUnrestrictedRecordKey(node) {
  const type = unwrapType(node);
  if (type === null) return false;
  if (
    type.type === "TSStringKeyword" ||
    type.type === "TSNumberKeyword" ||
    type.type === "TSSymbolKeyword"
  ) {
    return true;
  }
  if (type.type === "TSUnionType") {
    return type.types.some(isUnrestrictedRecordKey);
  }
  return false;
}

function isOpenDictionaryValue(node, aliases, resolving) {
  const type = unwrapType(node);
  if (type === null) return false;
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
  return node?.type === "Identifier" ? node.name : null;
}

function readNames(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const names = value.filter((name) => typeof name === "string" && name.length > 0);
  return names.length === 0 ? fallback : names;
}
