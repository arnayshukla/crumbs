#!/usr/bin/env python3
"""Build token-free Apple Shortcut installers for Crumbs.

The generated .wflow files use Apple's legacy shortcut plist format so they can
be signed with the built-in macOS command:

    shortcuts sign --mode anyone --input file.wflow --output file.shortcut

No live endpoint or capture token belongs in source control. Apple Shortcuts
asks for both values when the user imports an installer.
"""

from __future__ import annotations

import argparse
import plistlib
import uuid
from pathlib import Path
from typing import Any


PLACEHOLDER_ENDPOINT = "https://your-crumbs.example/api/quick-capture"
PLACEHOLDER_TOKEN = "paste-your-capture-token"
REPLACEMENT_CHARACTER = "\ufffc"


def new_id() -> str:
    return str(uuid.uuid4()).upper()


def action(identifier: str, parameters: dict[str, Any]) -> dict[str, Any]:
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": parameters,
    }


def output_attachment(action_id: str, output_name: str) -> dict[str, Any]:
    return {
        "Value": {
            "OutputUUID": action_id,
            "Type": "ActionOutput",
            "OutputName": output_name,
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def file_attachment(action_id: str, output_name: str) -> dict[str, Any]:
    """Wrap an action output as a multipart Form file parameter."""
    return {
        "Value": {
            "Value": output_attachment(action_id, output_name),
            "WFSerializationType": "WFTokenAttachmentParameterState",
        },
        "WFSerializationType": "WFTokenAttachmentParameterState",
    }


def extension_input() -> dict[str, Any]:
    return {
        "Value": {"Type": "ExtensionInput"},
        "WFSerializationType": "WFTextTokenAttachment",
    }


def token_string(
    prefix: str,
    action_id: str,
    output_name: str,
    suffix: str = "",
) -> dict[str, Any]:
    replacement_start = len(prefix)
    value: dict[str, Any] = {
        "string": f"{prefix}{REPLACEMENT_CHARACTER}{suffix}",
        "attachmentsByRange": {
            f"{{{replacement_start}, 1}}": {
                "OutputUUID": action_id,
                "Type": "ActionOutput",
                "OutputName": output_name,
            }
        },
    }
    return {"Value": value, "WFSerializationType": "WFTextTokenString"}


def dictionary_value(items: list[tuple[str, int, Any]]) -> dict[str, Any]:
    fields = []
    for key, item_type, value in items:
        fields.append(
            {
                "WFKey": {
                    "Value": {"string": key},
                    "WFSerializationType": "WFTextTokenString",
                },
                "WFItemType": item_type,
                "WFValue": value,
            }
        )
    return {
        "Value": {"WFDictionaryFieldValueItems": fields},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def text_field(value: Any) -> Any:
    if isinstance(value, str):
        return {
            "Value": {"string": value},
            "WFSerializationType": "WFTextTokenString",
        }
    return value


def menu_actions(prompt: str) -> tuple[list[dict[str, Any]], str]:
    group_id = new_id()
    empty_tags_id = new_id()
    prompt_tags_id = new_id()
    result_id = new_id()
    actions = [
        action(
            "is.workflow.actions.choosefrommenu",
            {
                "WFMenuPrompt": prompt,
                "WFControlFlowMode": 0,
                "WFMenuItems": ["Save now", "Add tags"],
                "GroupingIdentifier": group_id,
            },
        ),
        action(
            "is.workflow.actions.choosefrommenu",
            {
                "WFMenuItemTitle": "Save now",
                "GroupingIdentifier": group_id,
                "WFControlFlowMode": 1,
            },
        ),
        action(
            "is.workflow.actions.gettext",
            {"WFTextActionText": "", "UUID": empty_tags_id},
        ),
        action(
            "is.workflow.actions.choosefrommenu",
            {
                "WFMenuItemTitle": "Add tags",
                "GroupingIdentifier": group_id,
                "WFControlFlowMode": 1,
            },
        ),
        action(
            "is.workflow.actions.ask",
            {
                "WFAskActionPrompt": "Tags (comma or space separated)",
                "WFInputType": "Text",
                "UUID": prompt_tags_id,
            },
        ),
        action(
            "is.workflow.actions.choosefrommenu",
            {
                "UUID": result_id,
                "GroupingIdentifier": group_id,
                "WFControlFlowMode": 2,
            },
        ),
    ]
    return actions, result_id


def response_actions(request_id: str) -> list[dict[str, Any]]:
    # Quick Capture negotiates a plain-text response for Apple Shortcuts, so
    # the notification can display the server's actual success or error text
    # without relying on iOS to coerce Text into a Dictionary.
    return [
        action(
            "is.workflow.actions.notification",
            {
                "WFNotificationActionBody": token_string(
                    "", request_id, "Contents of URL"
                ),
                "UUID": new_id(),
            },
        )
    ]


def base_workflow(actions: list[dict[str, Any]], *, share_sheet: bool) -> dict[str, Any]:
    workflow_types = ["Watch", "WFWorkflowTypeShowInSearch"]
    input_classes: list[str] = []
    if share_sheet:
        workflow_types.insert(0, "ActionExtension")
        input_classes = [
            "WFAppContentItem",
            "WFArticleContentItem",
            "WFGenericFileContentItem",
            "WFImageContentItem",
            "WFRichTextContentItem",
            "WFSafariWebPageContentItem",
            "WFStringContentItem",
            "WFURLContentItem",
        ]
    return {
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": -2873601,
            "WFWorkflowIconGlyphNumber": 61440,
        },
        "WFWorkflowClientVersion": "4711",
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowInputContentItemClasses": input_classes,
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": 0,
                "Category": "Parameter",
                "ParameterKey": "WFTextActionText",
                "Text": "Paste the Quick Capture endpoint shown in Crumbs settings",
            },
            {
                "ActionIndex": 1,
                "Category": "Parameter",
                "ParameterKey": "WFTextActionText",
                "Text": "Paste the capture-only token created in Crumbs settings",
            },
        ],
        "WFWorkflowTypes": workflow_types,
        "WFQuickActionSurfaces": [],
        "WFWorkflowHasShortcutInputVariables": share_sheet,
        "WFWorkflowActions": actions,
    }


def build_share_workflow() -> dict[str, Any]:
    endpoint_id = new_id()
    token_id = new_id()
    text_id = new_id()
    images_id = new_id()
    request_id = new_id()
    menu, menu_result_id = menu_actions("Capture to Crumbs")
    actions = [
        action(
            "is.workflow.actions.gettext",
            {"WFTextActionText": PLACEHOLDER_ENDPOINT, "UUID": endpoint_id},
        ),
        action(
            "is.workflow.actions.gettext",
            {"WFTextActionText": PLACEHOLDER_TOKEN, "UUID": token_id},
        ),
        *menu,
        action(
            "is.workflow.actions.detect.text",
            {"WFInput": extension_input(), "UUID": text_id},
        ),
        action(
            "is.workflow.actions.detect.images",
            {"WFInput": extension_input(), "UUID": images_id},
        ),
        action(
            "is.workflow.actions.downloadurl",
            {
                "WFHTTPHeaders": dictionary_value(
                    [
                        ("Accept", 0, text_field("text/plain")),
                        (
                            "Authorization",
                            0,
                            token_string("Bearer ", token_id, "Text"),
                        )
                    ]
                ),
                "WFHTTPMethod": "POST",
                "WFHTTPBodyType": "Form",
                # Apple uses this request variable to carry file bytes into
                # the multipart encoder; the Form dictionary describes the
                # field name and file type.
                "WFRequestVariable": output_attachment(images_id, "Images"),
                "WFFormValues": dictionary_value(
                    [
                        ("input", 0, token_string("", text_id, "Text")),
                        ("tags", 0, token_string("", menu_result_id, "Menu Result")),
                        # Form file fields use item type 5 plus Apple's file
                        # parameter-state wrapper. This preserves every shared
                        # image as a multipart attachment.
                        ("images", 5, file_attachment(images_id, "Images")),
                        ("client", 0, text_field("apple-shortcut")),
                        ("clientVersion", 0, text_field("3")),
                    ]
                ),
                "WFURL": token_string("", endpoint_id, "Text"),
                "UUID": request_id,
            },
        ),
        *response_actions(request_id),
    ]
    return base_workflow(actions, share_sheet=True)


def build_voice_workflow() -> dict[str, Any]:
    endpoint_id = new_id()
    token_id = new_id()
    dictate_id = new_id()
    request_id = new_id()
    dictation_condition_id = new_id()
    menu, menu_result_id = menu_actions("Save voice note")
    actions = [
        action(
            "is.workflow.actions.gettext",
            {"WFTextActionText": PLACEHOLDER_ENDPOINT, "UUID": endpoint_id},
        ),
        action(
            "is.workflow.actions.gettext",
            {"WFTextActionText": PLACEHOLDER_TOKEN, "UUID": token_id},
        ),
        action(
            "is.workflow.actions.dictatetext",
            {
                "WFDictateTextLanguage": "Default",
                "WFDictateTextStopListening": "After Pause",
                "UUID": dictate_id,
            },
        ),
        action(
            "is.workflow.actions.conditional",
            {
                "WFInput": {
                    "Type": "Variable",
                    "Variable": output_attachment(dictate_id, "Dictated Text"),
                },
                "WFControlFlowMode": 0,
                "GroupingIdentifier": dictation_condition_id,
                "WFCondition": 100,
            },
        ),
        *menu,
        action(
            "is.workflow.actions.downloadurl",
            {
                "WFHTTPHeaders": dictionary_value(
                    [
                        ("Accept", 0, text_field("text/plain")),
                        (
                            "Authorization",
                            0,
                            token_string("Bearer ", token_id, "Text"),
                        )
                    ]
                ),
                "WFHTTPMethod": "POST",
                "WFJSONValues": dictionary_value(
                    [
                        ("title", 0, text_field("Voice note")),
                        ("input", 0, token_string("", dictate_id, "Dictated Text")),
                        (
                            "tags",
                            0,
                            token_string("voice ", menu_result_id, "Menu Result"),
                        ),
                        ("mode", 0, text_field("voice")),
                        ("client", 0, text_field("apple-watch")),
                        ("clientVersion", 0, text_field("1")),
                    ]
                ),
                "WFURL": token_string("", endpoint_id, "Text"),
                "UUID": request_id,
            },
        ),
        *response_actions(request_id),
        action(
            "is.workflow.actions.conditional",
            {"GroupingIdentifier": dictation_condition_id, "WFControlFlowMode": 1},
        ),
        action(
            "is.workflow.actions.notification",
            {"WFNotificationActionBody": "Nothing to capture", "UUID": new_id()},
        ),
        action(
            "is.workflow.actions.conditional",
            {
                "WFControlFlowMode": 2,
                "GroupingIdentifier": dictation_condition_id,
                "UUID": new_id(),
            },
        ),
    ]
    return base_workflow(actions, share_sheet=False)


def write_workflow(path: Path, workflow: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(workflow, handle, fmt=plistlib.FMT_BINARY, sort_keys=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("build/apple-shortcuts"),
    )
    args = parser.parse_args()
    write_workflow(args.output_dir / "capture-to-crumbs.wflow", build_share_workflow())
    write_workflow(args.output_dir / "voice-to-crumbs.wflow", build_voice_workflow())


if __name__ == "__main__":
    main()
