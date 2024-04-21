// This is the main entry point for the extension
import * as vscode from 'vscode';
import gql from 'graphql-tag';

/**
 *  ---------------------
 * |  GraphQL Extractor  |
 *  ---------------------
 * [=> extract GraphQL queries from files and generate client-side queries and TypeScript types code for them.
 */


// A function to extract config form gql-extract.config.js file
async function configExtractor(rootFolderUri: any): Promise<any | false> {
	let configUri = vscode.Uri.joinPath(rootFolderUri, 'gql-extract.config.json');
	try{
		// Open the config file and read its content
		let document = await vscode.workspace.openTextDocument(configUri);
		let content = document.getText();
		return JSON.parse(content);
	} catch {
		vscode.window.showInformationMessage('No config file found');
		return false;
	}
}

// A function to generate typescript types
async function astToApisConvertor(
	astDefinitions: any, 
	apisFolderUri: any,
	queriesFolderUri: any,
	typesFolderUri: any,
){
	// Extract the definitions fileds from the AST to create client-queries
	let astDefinitionsFileds = definitionsFiledsExtractor(astDefinitions);
	if (astDefinitionsFileds.length === 0) {
		vscode.window.showInformationMessage('No GraphQL AST definitions fileds files found');
		return;
	}
	// Define the options for the quick pick
	let options: vscode.QuickPickItem[] = [
		{ label: 'Yes', description: 'Allow the extension to rewrite the file' },
		{ label: 'YesAll', description: 'Allow the extension to rewrite all files' },
		{ label: 'No', description: 'Deny the extension from rewrite the file' }
	];
	let isYesAllSelected = false;
	// Loop through each types name
  for(let query of astDefinitionsFileds){

		// Create a new file name in types folder name based on the type name for all types !== Query || Mutation
		let newFileName = query.name.value + '.ts';
		// Create a new file URI in the queries folder
		let newFileUri = vscode.Uri.joinPath(apisFolderUri, newFileName);
		// A function to generate file with new content
		async function generateFile(){
			// get field type name to extract the return type for apis
			let fieldName = fieldTypeNameExtractor(query);
			let isArray = isArrayType(query);
			// main typescript types
			const mainTypes = ["number", "boolean", "Date", "string"];
			// Generate the code of the type using AST def
			let code = "";
			// exit importing lines:
			code += `import { client } from "@/config/apollo"; \n`;
			code += `import { ${query.name.value} } from `;
			code += `"../${queriesFolderUri}/${query.name.value}"; \n`;
			code += ` \n`;
			let type = typeNameToTsTypesExtractor(fieldTypeNameExtractor(query));
			if(type !== "number" && type !== "boolean" && type !== "Date" && type !== "string"){
				code += `import { ${typeNameToTsTypesExtractor(fieldTypeNameExtractor(query))} } from `;
				code += `"../${typesFolderUri}/${fieldTypeNameExtractor(query)}"; \n`;
			}
			const DuplicateIdentifiers: Array<string> = [];
			// through each field to check if this type have a sub-types and write an importing line
			for(let argument of query.arguments){

				let isTypeScriptType = false;
				// check if field type name equal to any of main typescript types
				for(let minType of mainTypes){
					if(minType == typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument))){
						isTypeScriptType = isTypeScriptType || true;
					}
				}
				let isIdentifier = false;
				// check if field type is not identifier before
				if( ! isTypeScriptType ){
					for(let DuplicateIdentifier of DuplicateIdentifiers){
						if(DuplicateIdentifier == typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument))){
							isIdentifier = isIdentifier || true;
						}
					}
				}
				// if the type is not typescript type and is not identifier before Append import line to code content
				if( ( ! isTypeScriptType ) && ( ! isIdentifier ) ){
					// write import line to the code
					code += `import { `
					code += `${typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument))}`;
					code += ` } from "../${typesFolderUri}/${typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument)).slice(0, -3)}"\n`;
					// add type name to DuplicateIdentifiers
					DuplicateIdentifiers.push(
						typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument))
					);

				}
			}
			code += ` \n`
			// api function:
			code +=	`export async function handel_${capitalizeFirstLetter(query.name.value)}( \n`;
			// function argument
			let functionArgument = query.arguments.map((argument: any)=>(
				`	${argument.name.value}Input` +
				(
					(argument.type.kind === "NonNullType") ||
					(argument.type && argument.type.type && argument.type.type.kind && argument.type.type.kind === "NonNullType") ||
					(argument.type && argument.type.type && argument.type.type.type && argument.type.type.type.kind && 
						argument.type.type.type.kind === "NonNullType")
					? `:` : `?:`
				) + 
				` ${typeNameToTsTypesExtractor(fieldTypeNameExtractor(argument))}, \n`
			))
			code += rankTypescriptFunctionArgguments(functionArgument).join("");
			code += `	functionToImplementation?: Function \n`;
			code += `) : Promise<${typeNameToTsTypesExtractor(fieldName)}${isArray ? "[] | []" : " | null"}> { \n`;
			// returned data variable
			code += `	let ${query.name.value}Data : ${typeNameToTsTypesExtractor(fieldName)}${isArray ? "[]" : ""}; \n`;
			code += `	try { \n`;
			// use apollo clint
			code += query.defType == "Mutation"
				? `		const { data, errors } = await client.mutate({ \n`
				: `		const { data, error } = await client.query({ \n`;
			code += query.defType == "Mutation"
			? `			mutation: ${query.name.value}, \n`
			: `			query: ${query.name.value}, \n`;
			code += `			variables: { \n`;
			// query inputs
			code += query.arguments.map((argument: any)=>(
				`				${argument.name.value}Input: ${argument.name.value}Input, \n`
			)).join("");
			code += `			}, \n`;
			code += `		}); \n`;
			code += query.defType == "Mutation"
				? `		if( ! errors ){ \n`
				: `		if( ! error ){ \n`;
			code += `			${query.name.value}Data = data.${query.name.value}; \n`;
			code += `			functionToImplementation && functionToImplementation(); \n`;
			code += `			return ${query.name.value}Data; \n`;
			code += `		}; \n`;
			code += `		return ${isArray ? "[]" : "null"} \n`;
			code += `	} catch (e) { \n`;
			code += `		console.log("🚀 ~ file: ${query.name.value}.ts ~ ${query.name.value} ~ e", e); \n`;
			code += `		return ${isArray ? "[]" : "null"}; \n`;
			code += `	}`;
			code += `}`;

			// Write the code to the new queries file
			await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(code, 'utf8'));
			// Set the language of the new queries file to TypeScript
			await vscode.languages.setTextDocumentLanguage(
				await vscode.workspace.openTextDocument(newFileUri), 
				'typescript'
			);
		}

		try{
			// Open the file and read its content
			let document = await vscode.workspace.openTextDocument(newFileUri);
			let content = document.getText();
			// rewrite all files if yesAll option selected
			// or show the option for user
			if( isYesAllSelected ){
				generateFile();
			} else {
				// Show the quick pick to the user and get their response
				await vscode.window.showQuickPick(options, { placeHolder: `Do you want to rewrite ${newFileName} type file?` })
				.then(async (selection) => {
					// Check the selection
					if (!selection) {
						// The user canceled the quick pick
						return;
					}

					if (selection.label === 'Yes') {
						// if yse generate file for this queries
						generateFile();
					}
					else if (selection.label === 'YesAll') {
						isYesAllSelected = true;
					} else {
							// The user denied the extension to read the file
							// Show a message to the user
							vscode.window.showErrorMessage('The extension cannot proceed without reading the file.');
					}
			});
			}
		}
		// when no file found
		catch{
			generateFile();
		}

	}

}

// A function to generate client queries
async function astToTsQueriesConvertor(astDefinitions: any, queriesFolderUri: any, library: "apollo"){
	// Extract the definitions fileds from the AST to create client-queries
	let astDefinitionsFileds = definitionsFiledsExtractor(astDefinitions);
	if (astDefinitionsFileds.length === 0) {
		vscode.window.showInformationMessage('No GraphQL AST definitions fileds files found');
		return;
	}
	vscode.window.showInformationMessage('GraphQL AST definitions fileds files found');
	// Define the options for the quick pick
	let options: vscode.QuickPickItem[] = [
		{ label: 'Yes', description: 'Allow the extension to rewrite the file' },
		{ label: 'YesAll', description: 'Allow the extension to rewrite all files' },
		{ label: 'No', description: 'Deny the extension from rewrite the file' }
	];
	let isYesAllSelected = false;
	// Loop through each queries name
	for (let queryField of astDefinitionsFileds) {

		// Create a new file name based on the query name
		let newFileName = queryField.name.value + '.ts';
		// Create a new file URI in the queries folder
		let newFileUri = vscode.Uri.joinPath(queriesFolderUri, newFileName);
		// A function to generate file with new content
		async function generateFile(){
			// Generate the code of the queries using AST field
			// Import the graphgl client side library
			let queryCode = "";
			if(library){
				if(library === "apollo"){
					queryCode += `import { gql } from "@apollo/client";`;
				}
			}
			queryCode += ` \n`;
			queryCode += "export const " + queryField.name.value + " = ";
			// using the graphgl client side library function
			if(library){
				if(library === "apollo"){
					queryCode += "gql`";
				}
			}
			queryCode += defineQuery(queryField, queryField.defType);
			queryCode += "`";
			// Write the code to the new queries file
			await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(queryCode, 'utf8'));
			// Set the language of the new queries file to TypeScript
			await vscode.languages.setTextDocumentLanguage(
				await vscode.workspace.openTextDocument(newFileUri), 
				'typescript'
			);
		}

		try{
			// Open the file and read its content
			let document = await vscode.workspace.openTextDocument(newFileUri);
			let content = document.getText();
			// rewrite all files if yesAll option selected
			// or show the option for user
			if( isYesAllSelected ){
				generateFile();
			} else {
				// Show the quick pick to the user and get their response
				await vscode.window.showQuickPick(
					options, 
					{ placeHolder: `Do you want to rewrite ${newFileName} query file?` }
				)
				.then(async (selection) => {
					// Check the selection
					if (!selection) {
						// The user canceled the quick pick
						return;
					}

					if (selection.label === 'Yes') {
						// if yse generate file for this queries
						generateFile();
					}
					else if (selection.label === 'YesAll') {
						isYesAllSelected = true;
					} else {
							// The user denied the extension to read the file
							// Show a message to the user
							vscode.window.showErrorMessage('The extension cannot proceed without reading the file.');
					}
			});
			}
		} catch {
			generateFile();
		}
	}
}

// A function to generate typescript types
async function astToTsTypesConvertor(astDefinitions: any, typesFolderUri: any){
	// maping throw definitions
	let defTypes = astDefinitions.filter((def: any) => 
      (
				def.kind === 'ObjectTypeDefinition' || 
				def.kind === "InputObjectTypeDefinition" ||
				def.kind === "EnumTypeDefinition"
			) && 
      def.name && 
      (def.name.value !== 'Query' && def.name.value !== 'Mutation')
	);
	// Define the options for the quick pick
	let options: vscode.QuickPickItem[] = [
		{ label: 'Yes', description: 'Allow the extension to rewrite the file' },
		{ label: 'YesAll', description: 'Allow the extension to rewrite all files' },
		{ label: 'No', description: 'Deny the extension from rewrite the file' }
	];
	let isYesAllSelected = false;
	// Loop through each types name
  for(let defType of defTypes){

		// Create a new file name in types folder name based on the type name for all types !== Query || Mutation
		let newFileName = defType.name.value + '.ts';
		// Create a new file URI in the queries folder
		let newFileUri = vscode.Uri.joinPath(typesFolderUri, newFileName);
		// A function to generate file with new content
		async function generateFile(){
			// main typescript types
			const mainTypes = ["number", "boolean", "Date", "string"];
			// Generate the code of the type using AST def
			let code = "";
			// exit importing lines:
			const DuplicateIdentifiers: Array<string> = [];
			// check if the deftype isn't enum
			// if it's type loop through each field to check if this type have a sub-types and write an importing line
			if(defType.fields){
				for(let filed of defType.fields){

					let isTypeScriptType = false;
					// check if field type name equal to any of main typescript types
					for(let minType of mainTypes){
						if(minType == typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed))){
							isTypeScriptType = isTypeScriptType || true;
						}
					}
					let isIdentifier = false;
					// check if field type is not identifier before
					if( ! isTypeScriptType ){
						for(let DuplicateIdentifier of DuplicateIdentifiers){
							if(DuplicateIdentifier == typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed))){
								isIdentifier = isIdentifier || true;
							}
						}
					}
					// if the type is not typescript type and is not identifier before Append import line to code content
					if( ( ! isTypeScriptType ) && ( ! isIdentifier ) ){
						// write import line to the code
						code += `import { `
						code += `${typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed))}`;
						code += ` } from "./${typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed)).slice(0, -3)}"\n`;
						// add type name to DuplicateIdentifiers
						DuplicateIdentifiers.push(
							typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed))
						);
	
					}
				}
			}
			// check if it's enum
			code += defType.kind === "EnumTypeDefinition"
				? `export enum ${defType.name.value}Dto { \n`
				: `export type ${defType.name.value}Dto = { \n`;
			// check if it's enum
			code += defType.kind === "EnumTypeDefinition"
				? defType.values.map((value: any)=>(
						`${value.name.value} = "${value.name.value}", \n`
					)).join("")
				: defType.fields.map((filed: any)=>(
						`	${filed.name.value}${
								defType.kind === "InputObjectTypeDefinition" && (
									(filed.type.kind === "NonNullType") ||
									(filed.type && filed.type.type && filed.type.type.kind && filed.type.type.kind === "NonNullType") ||
									(filed.type && filed.type.type && filed.type.type.type && filed.type.type.type.kind && 
										filed.type.type.type.kind === "NonNullType"
									)
								) 
								? ":" 
								: defType.kind === "InputObjectTypeDefinition" ? "?:" : ":"
							} ${typeNameToTsTypesExtractor(fieldTypeNameExtractor(filed))}` +
						`${isArrayType(filed) ? "[]" : ''} \n`
					)).join("")
			// Append the closing curly brace
			code +=	`};`;
			// Write the code to the new queries file
			await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(code, 'utf8'));
			// Set the language of the new queries file to TypeScript
			await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(newFileUri), 'typescript');
		}

		try{
			// Open the file and read its content
			let document = await vscode.workspace.openTextDocument(newFileUri);
			let content = document.getText();
			// rewrite all files if yesAll option selected
			// or show the option for user
			if( isYesAllSelected ){
				generateFile();
			} else {
				// Show the quick pick to the user and get their response
				await vscode.window.showQuickPick(options, { placeHolder: `Do you want to rewrite ${newFileName} type file?` })
				.then(async (selection) => {
					// Check the selection
					if (!selection) {
						// The user canceled the quick pick
						return;
					}

					if (selection.label === 'Yes') {
						// if yse generate file for this queries
						generateFile();
					}
					else if (selection.label === 'YesAll') {
						isYesAllSelected = true;
					} else {
							// The user denied the extension to read the file
							// Show a message to the user
							vscode.window.showErrorMessage('The extension cannot proceed without reading the file.');
					}
			});
			}
		}
		// when no file found
		catch{
			generateFile();
		}

	}

}

let subFieldRootState = 2;
// A function to covert ast fields to query fields
function astToQueryConvertor(subField: any){
  let query = "";
  // Append tab space
  for(let i = 0; i < subFieldRootState; i++){
		query += `    `;
	}
  query += subField.fieldName;
  // Check if the field has a subFields set
  if (subField.subFields && subField.subFields.length > 0) {
		// count subFieldRootState + 1
		++subFieldRootState;
    // Append the opening curly brace to the query field
    query += " { ";
    // Append new lin
    query += `\n`;
    // => Loop through the subFields
    for (let subFieldSubs of subField.subFields) {
      // Check if the field has a subFields set
      if (subFieldSubs.subFields && subFieldSubs.subFields.length > 0) {
        query += astToQueryConvertor(subFieldSubs);
      } else {
				// Append tab space
				for(let i = 0; i < subFieldRootState; i++){
					query += `    `;
				}
				// Append the sub-field name
				query += subFieldSubs.fieldName;
			}
      // Append new lin
      query += `\n`;
    }
		// Append tab space
    for(let i = 1; i < subFieldRootState; i++){
			query += `    `;
		}
    // Append the closing curly brace to the query
    query += "}";
		// reset subFieldRootState to 1
		--subFieldRootState;

  }

	// return the result
	return query;

}

// A function to extract the field type name
function fieldTypeNameExtractor(field: any){
  // field type name could be in form first subkey type (field.type.name.value) 
  // to fourth subkey type (field.type.type.type.type.name.value)
  return(
    field.type && field.type.name ? (field.type.name.value)
    : field.type && field.type.type && field.type.type.name ? (field.type.type.name.value)
    : field.type && field.type.type && field.type.type.type && 
			field.type.type.type.name ? (field.type.type.type.name.value)
    : field.type && field.type.type && field.type.type.type && field.type.type.type.type && 
			field.type.type.type.type.name ? (field.type.type.type.type.name.value)
		: "any"
  )
}
// A function to extract the field type name as typescript type
function typeNameToTsTypesExtractor(fieldTypeName: any){
	if(
		fieldTypeName === "Int" || 
		fieldTypeName === "Float" || 
		fieldTypeName === "BigInt" || 
		fieldTypeName === "NegativeFloat" || 
		fieldTypeName === "NonNegativeFloat" || 
		fieldTypeName === "NegativeInt" || 
		fieldTypeName === "NonNegativeInt" || 
		fieldTypeName === "NonPositiveFloat" || 
		fieldTypeName === "NonPositiveInt" || 
		fieldTypeName === "PositiveFloat" || 
		fieldTypeName === "PositiveInt" || 
		fieldTypeName === "AccountNumber"
	){
		return "number"
	}
	if(fieldTypeName === "Boolean"){
		return "boolean"
	}
	if(
		fieldTypeName === "DateTime"|| 
		fieldTypeName === "LocalDate"|| 
		fieldTypeName === "LocalDateTime"|| 
		fieldTypeName === "LocalEndTime"|| 
		fieldTypeName === "LocalTime"|| 
		fieldTypeName === "Time"|| 
		fieldTypeName === "TimeZone"|| 
		fieldTypeName === "Timestamp"|| 
		fieldTypeName === "Date"
	){
		return "Date"
	}
	if(
		fieldTypeName === "String" || 
		fieldTypeName === "CountryCode" || 
		fieldTypeName === "Cuid" || 
		fieldTypeName === "Currency" || 
		fieldTypeName === "DeweyDecimal" || 
		fieldTypeName === "DID" || 
		fieldTypeName === "ID" || 
		fieldTypeName === "Duration" || 
		fieldTypeName === "EmailAddress" || 
		fieldTypeName === "HexColorCode" || 
		fieldTypeName === "Hexadecimal" || 
		fieldTypeName === "HSL" || 
		fieldTypeName === "IBAN" || 
		fieldTypeName === "IP" || 
		fieldTypeName === "IPCPatent" || 
		fieldTypeName === "HexColorCode" || 
		fieldTypeName === "IPv4" || 
		fieldTypeName === "IPv6" || 
		fieldTypeName === "ISBN" || 
		fieldTypeName === "HexColorCode" || 
		fieldTypeName === "JSON" || 
		fieldTypeName === "JSONObject" || 
		fieldTypeName === "JWT" || 
		fieldTypeName === "Latitude" || 
		fieldTypeName === "HexColorCode" || 
		fieldTypeName === "Locale" || 
		fieldTypeName === "Longitude" || 
		fieldTypeName === "MAC" || 
		fieldTypeName === "Locale" || 
		fieldTypeName === "NonEmptyString" || 
		fieldTypeName === "ObjectID" || 
		fieldTypeName === "PhoneNumber" || 
		fieldTypeName === "Port" || 
		fieldTypeName === "PostalCode" || 
		fieldTypeName === "RegularExpression" || 
		fieldTypeName === "RGB" || 
		fieldTypeName === "RGBA" || 
		fieldTypeName === "RoutingNumber" || 
		fieldTypeName === "SafeInt" ||  
		fieldTypeName === "SemVer" ||  
		fieldTypeName === "URL" ||  
		fieldTypeName === "USCurrency" ||  
		fieldTypeName === "UtcOffset" ||  
		fieldTypeName === "UUID" || 
		fieldTypeName === "Void" || 
		fieldTypeName === "Byte"
	){
		return "string"
	}
	return `${fieldTypeName}Dto`
}
// A function to check if the type of field is array
function isArrayType(field: any){
	let isArrayType: boolean = (
		field.type && field.type.kind === "ListType"
	) || (
		field.type && 
		field.type.type && field.type.type.kind && 
		field.type.type.kind === "ListType"
	);
	return isArrayType;
}

// A function to cabitalize the first letter in word
function capitalizeFirstLetter(word: string): string {
  // Check if the word is empty or not
  if (!word) {
    return word;
  }
  // Capitalize the first letter and return the word
  return word[0].toUpperCase() + word.slice(1);
}

// A function to extract the query sub-fields names for fields that have sub-fields
function subFieldsExtractor(astDefinitions: any, field: any){
  const mainTypes = ["Int", "Boolean", "DateTime", "String", "Float"]; 
  if(
		field.kind === "EnumTypeDefinition" ||
		(mainTypes.find(type => type === fieldTypeNameExtractor(field)) !== undefined)
	){
    return {
			...field,
      fieldName: field.name.value,
      subFields: []
    }
  }
  else {
		let def = astDefinitions.find((definition: any)=>(
			definition.name.value === fieldTypeNameExtractor(field)
		));

		if(def && def.fields){

			return {
				...field,
				fieldName: field.name.value,
				subFields: def.fields.map((subField: any)=> subFieldsExtractor(astDefinitions, subField))
			}
		} else {

			return {
				...field,
				fieldName: field.name.value,
				subFields: []
			}
		}

  }
}

// A function to extract the Query and Mutation definitions fileds from the AST
function definitionsFiledsExtractor(astDefinitions: any){
  return (
    astDefinitions.filter((def: any) => 
      def.kind === 'ObjectTypeDefinition' && 
      def.name && 
      (def.name.value === 'Query' || def.name.value === 'Mutation')
    )
    .map((def: any) => {
      return def.fields.map((field: any) => (
        {
          // contain main field data like name(will be the query name)
          ...field,
          // contain the def value(Query or Mutation) in the returned field item
          defType: def.name.value,
          // find the definition of field type by type name value 
          // if type definition have subfields get it
          // then we can use the result to generate query fields
          queryFields: subFieldsExtractor(astDefinitions, field)
        }
      ))
    }).flat()
  );
}

// to rank an array of strings, placing those with "?" at the end
function rankTypescriptFunctionArgguments(stringArray: string[]): string[] {
  // Sort the array with strings containing "?" higher in the order
  const rankedArray = stringArray.sort((a, b) => {
    if (a.includes("?") && !b.includes("?")) {
      return 1; // Move string with "?" higher
    } else if (!a.includes("?") && b.includes("?")) {
      return -1; // Move string without "?" lower
    } else {
      return 0; // Keep order the same if both have "?" or neither do
    }
  });

  return rankedArray;
}

// A function to define a query from a graphql AST object
function defineQuery(astField: any, operationType: "Mutation" | "Query" ): string {
  // Initialize an empty string for the query
  let query = "";
  // Check if the astField has arguments
  // Append this line to the query
  query += operationType === "Query" ? "query items" : "mutation myMutation";
  if (astField.arguments && astField.arguments.length > 0) {
    // Append the opening parenthesis to the start
    query += "(";
    // Loop through the arguments
    for (let arg of astField.arguments) {
			// Append new lin
			query += `\n`;
			// Append tab space
			query += `    `;
      // Append the argument name and value to the query
      query += "$" + arg.name.value + "Input" + ": ";
			query += isArrayType(arg) ? "[" : "";
			query += fieldTypeNameExtractor(arg);
			query += 
				(arg.type && arg.type.type && arg.type.type.kind && arg.type.type.kind === "NonNullType") ||
				(arg.type && arg.type.type && arg.type.type.type && arg.type.type.type.kind && 
					arg.type.type.type.kind === "NonNullType")
				? "!" : "";
			query += isArrayType(arg) ? "]" : "";
			query += arg.type.kind === "NonNullType" ? "!" : "";
			query += ", ";
    }
    // Remove the trailing comma and space
    query = query.slice(0, -2);
		// Append new lin
		query += `\n`;
    // Append the closing parenthesis to the start
    query += ")";
  }
  // Append the opening curly brace to the start
  query += " {";
  // Append new lin
  query += `\n`;
  // Check if the astField has a name
  if (astField.name) {
    // Append tab space
    query += `    `;
    // Append the name to the query
    query += astField.name.value + " ";
  }
  // Check if the astField has arguments
  if (astField.arguments && astField.arguments.length > 0) {
    // Append the opening parenthesis to the query
    query += "(";
    // Loop through the arguments
    for (let arg of astField.arguments) {
			// Append new lin
			query += `\n`;
      // Append tab space
      query += `    `;
      // Append tab space
      query += `    `;
      // Append the argument name and value to the query
      query += arg.name.value + ": " + "$" + arg.name.value + "Input" + ", ";
    }
    // Remove the trailing comma and space
    query = query.slice(0, -2);
		// Append new lin
		query += `\n`;
		// Append tab space
		query += `    `;
    // Append the closing parenthesis to the query
    query += ")";
  }
  // Check if the astField has a queries fields set
  if (astField.queryFields.subFields && astField.queryFields.subFields.length > 0) {
		// Append the opening curly brace to the query
		query += "{ ";
    // => Loop through the fields
    for (let subField of astField.queryFields.subFields) {
			// Append new lin
			query += `\n`;
      query += astToQueryConvertor(subField);
    }
		// Append new lin
		query += `\n`;
		// Append tab space
    query += `    `;
		// Append the closing curly brace to the query
		query += "} ";
  }

  // Append new lin
  query += `\n`;
  // Append the closing curly brace to the end
  query += "}";
  // Return the query
  return query;
}

// This function is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  // Register a command that is invoked when the user selects the 'Extract GraphQL Queries' option from the context menu
  let disposable = vscode.commands.registerCommand('gql-extract.extractGraphQLQueries', async (uri: vscode.Uri) => {
    // Get the current workspace folder
    let workspaceFolders = vscode.workspace.workspaceFolders  !== undefined ? vscode.workspace.workspaceFolders : [];
    for(let workspaceFolder of workspaceFolders){
			vscode.window.showInformationMessage('Found workspace folder');
			// extract config
			let config = await configExtractor(workspaceFolder.uri);
			// Create the apis folder in the root of the workspace folder
			let apisFolderUri = vscode.Uri.joinPath(
				workspaceFolder.uri, 
				config && config.apisFolderName && config.apisFolderName.length > 0 
				? config.apisFolderName : 'apis'
			);
			await vscode.workspace.fs.createDirectory(apisFolderUri);
			// Create the queries folder in the root of the workspace folder
			let queriesFolderUri = vscode.Uri.joinPath(
				workspaceFolder.uri, 
				config && config.queriesFolderName && config.queriesFolderName.length > 0 
				? config.queriesFolderName : 'queries'
			);
			await vscode.workspace.fs.createDirectory(queriesFolderUri);
			// Create the types folder in the root of the workspace folder
			let typesFolderUri = vscode.Uri.joinPath(
				workspaceFolder.uri, 
				config && config.typesFolderName && config.typesFolderName.length > 0 
				? config.typesFolderName : 'types'
			);
			await vscode.workspace.fs.createDirectory(typesFolderUri);
			// Find all GraphQL files in the workspace folder
			let files = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, '**/*.graphql'));
			if (files.length === 0) {
				vscode.window.showInformationMessage('No GraphQL files found');
				return;
			}
			vscode.window.showInformationMessage('GraphQL files found');
			// Loop through each file to get client-queries
			for (let file of files) {
				try {
					// Open the file and read its schemas
					let document = await vscode.workspace.openTextDocument(file);
					let schema = document.getText();
					// Parse the schema using graphql-tag library
					let ast = gql(schema);

					// get apis files from AST
					config && config.apis === "apollo" && await astToApisConvertor(
						ast.definitions,
						apisFolderUri,
						config && config.queriesFolderName && config.queriesFolderName.length > 0 
						? config.queriesFolderName : 'queries',
						config && config.typesFolderName && config.typesFolderName.length > 0 
						? config.typesFolderName : 'types'
					);

					// get typescript types from AST and create types files
					await astToTsTypesConvertor(ast.definitions, typesFolderUri);

					// get client queries from AST and create queries files
					await astToTsQueriesConvertor(ast.definitions, queriesFolderUri, config && config.apis);

					// Show a message to the user
					vscode.window.showInformationMessage(`Created queries and types from ${file.fsPath}`);

				} catch (error: any) {
					// Handle any errors
					vscode.window.showErrorMessage(`Error processing ${file.fsPath}: ${error.message}`);
				}
			}
		}
		if(workspaceFolders.length === 0){
			vscode.window.showErrorMessage('No workspace folder/s found');
			return;
		}

  });

  // Add the command to the extension context
  context.subscriptions.push(disposable);
}

// This function is called when the extension is deactivated
export function deactivate() { }