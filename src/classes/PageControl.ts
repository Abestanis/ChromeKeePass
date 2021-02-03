import * as $ from 'jquery-slim';

import FieldSet from './FieldSet';
import * as IMessage from '../IMessage';
import { ISettings, defaultSettings } from '../Settings';
import Client from '../classes/BackgroundClient';
import CredentialsDropdown from "./CredentialsDropdown";

export default class PageControl
{
    private _installedEscapeHandler = false;
    private _fieldSets: FieldSet[] = [];
    private _foundCredentials?: IMessage.Credential[];
    private _settings: ISettings = defaultSettings;
    /** The dropdown that allows the user to choose credentials */
    private readonly _dropdown: CredentialsDropdown;

    constructor()
    {
        chrome.storage.sync.get(defaultSettings, (items)=>{
            this._settings = items as ISettings;
        });

        chrome.runtime.onMessage.addListener((message: IMessage.Request, _sender, _sendResponse)=>{
            if(message.type === IMessage.RequestType.redetectFields)
                this.detectFields();
        });
        this._dropdown = new CredentialsDropdown(this);
    }

    /** Try to detect credentials fields */
    public detectFields() {
        this.detectNewFields($('input'))
    }

    /**
     * Try to detect new credentials fields.
     * @param inputFields A list of changed or added input fields.
     */
    public detectNewFields(inputFields: JQuery) {
        let prevField: JQuery;
        let prevVisibleField: JQuery;
        inputFields.each((_, input) => { // Loop through all input fields
            const inputType = $(input).attr('type') || 'text'; // Get input type, if none default to "text"
            if (inputType === 'text' || inputType === 'email' || inputType === 'tel') { // A possible username field
                prevField = $(input);
                if ($(input).is(':visible')) {
                    prevVisibleField = $(input);
                }
            } else if (inputType === 'password'
                && !this._fieldSets.some((fieldSet) => fieldSet.passwordField.get(0) === input)) {
                // Found a new password field
                const usernameField = $(input).is(':visible') ? prevVisibleField : prevField;
                this._fieldSets.push(new FieldSet(this, $(input), usernameField));
            }
        });
        this._findCredentials();
        this._attachEscapeEvent();
    }

    private _attachEscapeEvent()
    {
        if (this._installedEscapeHandler || this._fieldSets.length === 0) {
            return; // We're not going to listen to key presses if we don't need them
        }
        this._installedEscapeHandler = true;
        $(document).on('keyup', (e: JQuery.KeyUpEvent<Document>)=>{
            if(e.key == 'Escape') {
                this._dropdown.close();
            }
        });
    }

    private _findCredentials()
    {
        if (this._foundCredentials === undefined && this._fieldSets.length) {
            // We should only look for credentials if we found input fields for it
            Client.findCredentials().then((credentials)=>{
                this._foundCredentials = credentials;
                this._fieldSets.forEach((fieldSet) => fieldSet.receivedCredentials());
            });
        }
    }

    get credentials(): IMessage.Credential[] | undefined
    {
        return this._foundCredentials;
    }

    get settings(): ISettings
    {
        return this._settings;
    }

    get dropdown(): CredentialsDropdown {
        return this._dropdown;
    }
}
