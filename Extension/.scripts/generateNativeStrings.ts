/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { parse } from 'comment-json';
import { resolve } from 'path';
import { read, write } from './common';

// ****************************
// Command: generate-native-strings
// The following is used to generate nativeStrings.ts and localized_string_ids.h from ./src/nativeStrings.json
// If adding localized strings to the native side, start by adding it to nativeStrings.json and use this to generate the others.
// ****************************
export async function main() {
    const $root = resolve(`${__dirname}/..`);

    const stringTable = parse(await read(`${$root}/src/nativeStrings.json`)) as any;

    let nativeEnumContent = "";

    let nativeStringTableContent = "";

    let typeScriptSwitchContent = "";

    let stringIndex = 1;

    for (const property in stringTable) {
        let stringValue = stringTable[property];

        let hintValue;

        if (typeof stringValue !== "string") {
            hintValue = stringValue.hint;

            stringValue = stringValue.text;
        }

        // Add to native enum
        nativeEnumContent += `    ${property} = ${stringIndex},\n`;

        // Add to native string table
        nativeStringTableContent += `    ${JSON.stringify(stringValue)},\n`;

        // Add to TypeScript switch
        // Skip empty strings, which can be used to prevent enum/index reordering
        if (stringValue !== "") {
            // It's possible that a translation may skip "{#}" entries, so check for up to 50 of them.
            let numArgs = 0;

            for (let i = 0; i < 50; i++) {
                if (stringValue.includes(`{${i}}`)) {
                    numArgs = i + 1;
                }
            }

            typeScriptSwitchContent += `        case ${stringIndex}:\n`;

            if (numArgs !== 0) {
                typeScriptSwitchContent += `            if (stringArgs) {\n`;

                if (hintValue) {
                    typeScriptSwitchContent += `                message = localize({ key: ${JSON.stringify(property)}, comment: [${JSON.stringify(hintValue)}] }, ${JSON.stringify(stringValue)}`;
                } else {
                    typeScriptSwitchContent += `                message = localize(${JSON.stringify(property)}, ${JSON.stringify(stringValue)}`;
                }

                for (let i = 0; i < numArgs; i++) {
                    typeScriptSwitchContent += `, stringArgs[${i}]`;
                }

                typeScriptSwitchContent += `);\n                break;\n            }\n`;
            }

            if (hintValue) {
                typeScriptSwitchContent += `            message = localize({ key: ${JSON.stringify(property)}, comment: [${JSON.stringify(hintValue)}] }, ${JSON.stringify(stringValue)}`;
            } else {
                typeScriptSwitchContent += `            message = localize(${JSON.stringify(property)}, ${JSON.stringify(stringValue)}`;
            }

            typeScriptSwitchContent += `);\n            break;\n`;
        }
        ++stringIndex;
    }

    // --------------------------------------------------------------------------------------------
    // Generate the TypeScript file
    // --------------------------------------------------------------------------------------------

    const typeScriptContent = `/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// ****** This file is generated from nativeStrings.json.  Do not edit this file directly. ******

'use strict';

import * as nls from 'vscode-nls';

nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export const localizedStringCount: number = ${stringIndex};

export function lookupString(stringId: number, stringArgs?: string[]): string {
    let message: string = "";

    switch (stringId) {
        case 0:
            // Special case for blank string
            break;
${typeScriptSwitchContent}

        default:
            console.assert(\"Unrecognized string ID\");

            break;
    }

    return message;
}
`;

    // If the file isn't there, or the contents are different, write it out
    await write(`${$root}/src/nativeStrings.ts`, typeScriptContent);

    // --------------------------------------------------------------------------------------------
    // Generate the native string header file
    // --------------------------------------------------------------------------------------------
    const nativeContents = `/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All Rights Reserved.
 * See 'LICENSE' in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// ****** This file is generated from nativeStrings.json.  Do not edit this file directly. ******

#pragma once
// NOLINTBEGIN(modernize-raw-string-literal)
enum class localized_string_id : unsigned int
{
    blank = 0,
${nativeEnumContent}};

inline static const char *localizable_strings[] = {
    "",
${nativeStringTableContent}};
// NOLINTEND(modernize-raw-string-literal)
`;

    // If the file isn't there, or the contents are different, write it out
    await write(`${$root}/localized_string_ids.h`, nativeContents);
}
