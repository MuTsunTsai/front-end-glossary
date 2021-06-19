(function() {
	const field = document.getElementById('feg_data');
	const org_data = field.value;
	let feg_data = JSON.parse(org_data);

	let id = 0;
	for(let e of feg_data) {
		if(!e.a) e.a = false;
		if(e.id >= id) id = e.id + 1;
	}

	document.getElementById('feg_form').addEventListener('submit', function() {
		let json = JSON.stringify(app.entries);
		if(json != org_data) {
			field.value = json;
			document.getElementById('feg_data_version').value = new Date().getTime();
		}
	});

	Vue.component('field', {
		template: `
			<div class="d-flex mb-2">
				<label class="col-form-label me-3" style="white-space:nowrap;">{{label}}</label>
				<input type="text" v-bind:value="value" :disabled="disabled"
					v-on:change="$emit('input', $event.target.value)" class="flex-grow-1 w-100">
			</div>
		`,
		props: {
			disabled: Boolean,
			label: String,
			value: null
		}
	});

	Vue.component('textfield', {
		template: `
			<div class="col-12 mb-2">
				<div class="row align-items-top">
					<label class="col-12 col-sm-auto col-form-label" style="white-space:nowrap;">{{label}}</label>
					<div class="col">
						<textarea ref="ta" class="p-2 flex-grow-1 w-100" v-bind:value="value" v-on:change="change($event)"
							v-on:keydown="resize" style="resize:none; line-height:1.5;" rows="1"></textarea>
					</div>
				</div>
			</div>
		`,
		data: () => ({
			handler: null
		}),
		props: {
			label: String,
			value: null
		},
		mounted() {
			this.resize();
			window.addEventListener('resize', this.handler = () => this.resize());
		},
		beforeDestroy() {
			window.removeEventListener('resize', this.handler);
		},
		methods: {
			change(event) {
				setTimeout(() => this.resize(), 0);
				this.$emit('input', event.target.value);
			},
			resize() {
				let el = this.$refs.ta;
				el.style.height = 'auto';
				el.style.height = (el.scrollHeight + 5) + "px";
			}
		}
	});


	Vue.component('entry', {
		template: `
			<div class="row">
				<div class="col-12 col-sm-7">
					<div class="row">
						<field class="col-12 col-xl-6" label="英文：" v-model="entry.s"></field>
						<field class="col-12 col-xl-6" label="變化：" v-model="entry.p"></field>
					</div>
				</div>
				<div class="col-12 col-sm-5">
					<div class="row">
						<field class="col-12 col-xl-6" label="日文：" v-model="entry.j" :disabled="entry.a"></field>
						<field class="col-12 col-xl-6" label="中文：" v-model="entry.c" :disabled="entry.a"></field>
					</div>
				</div>
				<textfield v-model="entry.d" label="英文描述："></textfield>
				<textfield v-model="entry.t" label="中文描述："></textfield>
				<textfield v-model="entry.e" label="翻譯解釋："></textfield>
				<div class="col-6 mt-3">
					<div class="custom-control custom-checkbox">
						<input type="checkbox" class="custom-control-input" id="abbrCheck" v-model="entry.a">
						<label class="custom-control-label" for="abbrCheck">縮寫</label>
					</div>
				</div>
				<div class="col-6 text-end mt-3">
					<button type="button" class="button" v-on:click="$emit('del')">刪除</button>
				</div>
			</div>
		`,
		props: {
			entry: Object
		},
		watches: {
			"entry.a"(v) {
				if(!v) {
					this.entry.j = "";
					this.entry.c = "";
				}
			}
		}
	});

	let app = new Vue({
		el: '#feg_app',
		template: `
			<div class="feg-app small container-fluid mt-3">
				<div class="row mb-3">
					<div class="col-12 col-lg-4 col-xl-3">
						<div class="p-3 postbox" style="min-width:unset;">
							<div v-bind:class="{'mb-3':entries.length>0}">
								<button class="button" type="button" v-on:click="add">新增條目</button>
							</div>	
							<div style="column-width: 200px; cursor: pointer">
								<div v-for="e in ordered" v-on:click="selected=e" class="item"
									v-bind:class="selected==e?'bg-primary text-white':''">
									{{e.s}}
								</div>
							</div>
						</div>
					</div>
					<div class="col" v-if="selected">
						<div class="postbox p-3">
							<entry v-bind:entry="selected" v-bind:key="selected.id" v-on:del="del"></entry>
						</div>
					</div>
				</div>
			</div>
		`,
		data: {
			entries: feg_data,
			selected: null
		},
		computed: {
			ordered() {
				return this.entries.sort((e1, e2) => e1.s.localeCompare(e2.s));
			}
		},
		mounted() {
			this.selected = this.ordered[0] || null;
		},
		methods: {
			add() {
				let e = { id: id++, s: "", p: "", j: "", c: "", d: "", t: "", e: "" };
				this.entries.push(e);
				this.selected = e;
				setTimeout(() => jQuery(this.$el).find('input').get(0).focus(), 10);
			},
			del() {
				if(confirm("確定要刪除此條目？")) {
					this.entries.splice(this.entries.indexOf(this.selected), 1);
					this.selected = this.ordered[0] || null;
				}
			}
		}
	});
})();