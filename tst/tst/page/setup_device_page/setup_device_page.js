frappe.pages["setup-device-page"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("setup-device-page"),
		single_column: true,
	});
};

frappe.pages["setup-device-page"].on_page_show = function (wrapper) {
	load_desk_page(wrapper);
};

function load_desk_page(wrapper) {
	let $parent = $(wrapper).find(".layout-main-section");
	$parent.empty();

	frappe.require("setup_device_page.bundle.jsx").then(() => {
		frappe.setup_device_page = new frappe.ui.SetupDevicePage({
			wrapper: $parent,
			page: wrapper.page,
		});
	});
}