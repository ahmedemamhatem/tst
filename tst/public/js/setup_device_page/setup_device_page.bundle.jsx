import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

class SetupDevicePage {
	constructor({ page, wrapper }) {
		this.$wrapper = $(wrapper);
		this.page = page;
		this.init();
	}

	init() {
		this.setup_app();
	}

	setup_app() {
		const root = createRoot(this.$wrapper.get(0));
		root.render(<App />);
	}
}

frappe.provide("frappe.ui");
frappe.ui.SetupDevicePage = SetupDevicePage;
export default SetupDevicePage;