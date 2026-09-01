import {
  collectReturnStatements,
  getStaticName,
  isOpenType,
  unwrapExpression,
} from "../shared.mjs";

export const requireConstrainingSchemaRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require boundary declarations to use schemas that narrow raw input.",
    },
    messages: {
      constrainingSchemaRequired:
        "boundary(...) requires a constraining schema. Schemas that return any, unknown, object, an unrestricted record, or their raw input do not establish an owned value.",
    },
  },
  create(context) {
    const bindings = new Map();

    return {
      Program(node) {
        for (const statement of node.body) {
          if (statement.type !== "VariableDeclaration") continue;
          for (const declaration of statement.declarations) {
            if (declaration.id?.type !== "Identifier") continue;
            bindings.set(declaration.id.name, {
              init: declaration.init ?? null,
              type: declaration.id.typeAnnotation?.typeAnnotation ?? null,
            });
          }
        }
      },
      CallExpression(node) {
        const descriptor = unwrapExpression(node.arguments?.[0]);
        const schemas = isStrictBoundaryCall(node)
          ? [descriptor?.type === "ObjectExpression" ? propertyValue(descriptor, "schema") : null]
          : isTolerantBoundaryCall(node)
            ? tolerantSchemas(descriptor)
            : [];

        for (const schema of schemas) {
          if (isConstrainingSchema(schema, bindings, new Set())) continue;
          context.report({
            node: schema ?? descriptor ?? node,
            messageId: "constrainingSchemaRequired",
          });
        }
      },
    };
  },
};

function isStrictBoundaryCall(node) {
  const callee = unwrapExpression(node.callee);
  return callee?.type === "Identifier" && callee.name === "boundary";
}

function isTolerantBoundaryCall(node) {
  const callee = unwrapExpression(node.callee);
  return (
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.object?.type === "Identifier" &&
    callee.object.name === "boundary" &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "tolerant"
  );
}

function tolerantSchemas(descriptor) {
  if (descriptor?.type !== "ObjectExpression") return [null];
  const variants = unwrapExpression(propertyValue(descriptor, "variants"));
  if (variants?.type !== "ArrayExpression" || variants.elements.length === 0) {
    return [];
  }
  return variants.elements.map((element) => {
    const variant = unwrapExpression(element);
    return variant?.type === "ObjectExpression" ? propertyValue(variant, "schema") : null;
  });
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

function isConstrainingSchema(node, bindings, resolving) {
  const schema = unwrapExpression(node);
  if (schema === null) return false;

  if (schema.type === "Identifier") {
    if (schema.name === "undefined") return false;
    const binding = bindings.get(schema.name);
    if (!binding || resolving.has(schema.name)) return true;
    const next = new Set(resolving);
    next.add(schema.name);
    if (binding.init) return isConstrainingSchema(binding.init, bindings, next);
    return isConstrainingSchemaType(binding.type);
  }

  if (schema.type === "CallExpression") {
    const calleeName = getStaticName(schema.callee);
    if (["any", "unknown", "record", "passthrough", "catchall"].includes(calleeName)) {
      return false;
    }
    if (
      calleeName === "object" &&
      schema.arguments[0]?.type === "ObjectExpression" &&
      schema.arguments[0].properties.length === 0
    ) {
      return false;
    }
    return true;
  }

  if (schema.type === "MemberExpression") {
    return true;
  }

  if (schema.type !== "ObjectExpression") return false;
  const parse = schema.properties.find((property) =>
    (property.type === "Property" || property.type === "MethodDefinition") &&
    !property.computed &&
    ((property.key?.type === "Identifier" && property.key.name === "parse") ||
      (property.key?.type === "Literal" && property.key.value === "parse")),
  );
  const fn = parse?.value;
  if (!fn || !["ArrowFunctionExpression", "FunctionExpression"].includes(fn.type)) {
    return Boolean(parse?.method);
  }
  if (isOpenType(fn.returnType?.typeAnnotation)) return false;
  const parameter = fn.params?.[0];
  if (parameter?.type !== "Identifier") return true;
  return !collectReturnStatements(fn).some((returned) => {
    const value = unwrapExpression(returned.argument ?? returned.expression);
    return value?.type === "Identifier" && value.name === parameter.name;
  });
}

function isConstrainingSchemaType(type) {
  if (type?.type !== "TSTypeLiteral") return true;
  const parse = type.members.find((member) =>
    (member.type === "TSMethodSignature" || member.type === "TSPropertySignature") &&
    member.key?.type === "Identifier" && member.key.name === "parse",
  );
  if (!parse) return false;
  if (parse.type === "TSMethodSignature") {
    return !isOpenType(parse.returnType?.typeAnnotation);
  }
  const annotation = parse.typeAnnotation?.typeAnnotation;
  if (annotation?.type !== "TSFunctionType") return false;
  return !isOpenType(annotation.returnType?.typeAnnotation);
}
