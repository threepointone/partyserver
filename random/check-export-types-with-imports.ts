import * as ts from "typescript";

function checkIfExportMatchesType(
  fileName: string,
  typeName: string,
  typeModuleName: string
): void {
  // Create a TypeScript program with the file
  const program = ts.createProgram([fileName, typeModuleName], {});
  const checker = program.getTypeChecker();

  // Get the source file
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    throw new Error(`Source file ${fileName} not found`);
  }

  // Get the module where the type is declared
  const typeModule = program.getSourceFile(typeModuleName);
  if (!typeModule) {
    throw new Error(`Type module ${typeModuleName} not found`);
  }

  // Get the type from the type module
  const typeSymbol = checker.getSymbolAtLocation(typeModule);
  if (!typeSymbol) {
    throw new Error(
      `Type symbol ${typeName} not found in module ${typeModuleName}`
    );
  }

  const exportedType = checker
    .getExportsOfModule(typeSymbol)
    .find((sym) => sym.getName() === typeName);

  if (!exportedType) {
    throw new Error(`Type ${typeName} not found in module ${typeModuleName}`);
  }

  const typeNode = checker.getDeclaredTypeOfSymbol(exportedType);

  // Traverse the AST to find export declarations in the file
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      if (ts.isExportAssignment(node)) {
        // Handle export assignments (e.g., export default)
        const expr = node.expression;
        if (expr) {
          checkNodeType(expr, typeNode);
        }
      } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // Handle named exports
        for (const element of node.exportClause.elements) {
          const symbol = checker.getSymbolAtLocation(element.name);
          if (symbol) {
            const declaredType = checker.getTypeOfSymbolAtLocation(
              symbol,
              symbol.valueDeclaration!
            );
            if (checker.isTypeAssignableTo(declaredType, typeNode)) {
              console.log(
                `Export ${element.name.getText()} matches the type ${typeName}`
              );
            }
          }
        }
      }
    }
  });

  function checkNodeType(node: ts.Node, matchingType: ts.Type): void {
    const type = checker.getTypeAtLocation(node);
    if (checker.isTypeAssignableTo(type, matchingType)) {
      console.log(`Export matches the type ${typeName}`);
    }
  }
}

// Example usage:
const fileName = "example.ts"; // Replace with your file
const typeName = "WorkerEntryPoint"; // Replace with the type you want to match
const typeModuleName = "cloudflare:workers"; // Replace with the module where the type is declared

checkIfExportMatchesType(fileName, typeName, typeModuleName);
