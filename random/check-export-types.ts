import * as ts from "typescript";

function checkIfExportMatchesType(fileName: string, typeName: string): void {
  // Create a TypeScript program with the file
  const program = ts.createProgram([fileName], {});
  const checker = program.getTypeChecker();

  // Get the source file
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    throw new Error(`Source file ${fileName} not found`);
  }

  // Traverse the AST to find export declarations
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      // Handle export assignments (e.g., export default)
      if (ts.isExportAssignment(node)) {
        const expr = node.expression;
        if (expr) {
          checkNodeType(expr);
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
            const matchingType = checker.getTypeFromTypeNode(
              createTypeReference(typeName)
            );
            if (checker.isTypeAssignableTo(declaredType, matchingType)) {
              console.log(
                `Export ${element.name.getText()} matches the type ${typeName}`
              );
            }
          }
        }
      }
    }
  });

  function checkNodeType(node: ts.Node): void {
    const type = checker.getTypeAtLocation(node);
    const matchingType = checker.getTypeFromTypeNode(
      createTypeReference(typeName)
    );
    if (checker.isTypeAssignableTo(type, matchingType)) {
      console.log(`Export matches the type ${typeName}`);
    }
  }

  function createTypeReference(name: string): ts.TypeNode {
    return ts.factory.createTypeReferenceNode(name, []);
  }
}

// Example usage:
const fileName = "src/server/index.ts"; // Replace with your file
const typeName = "DurableObject"; // Replace with the type you want to match

checkIfExportMatchesType(fileName, typeName);
