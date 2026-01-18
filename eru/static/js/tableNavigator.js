class TableNavigator {
	constructor(tableSelector, options) {
		this.table = document.querySelector(tableSelector);
		this.currentIndex = -1;
	}
	nextRow() {
		const rows = this.table.querySelectorAll('tbody tr');
		if (this.currentIndex < rows.length - 1) {
			this.currentIndex++;
			this._highlightRow(rows);
		}
	}
	
	previousRow() {
		const rows = this.table.querySelectorAll('tbody tr');
		if (this.currentIndex > 0) {
			this.currentIndex--;
			this._highlightRow(rows);
		}
	}
	
	enterRow() {
		const activeRow = this.table.querySelector('tr.selected');
		if (activeRow) activeRow.click(); // Ou sua lógica de acesso
	}
	nextPage(){}
	previousPage(){}
	firstPage(){}
	lastPage(){}
	
	_highlightRow(rows) {
		rows.forEach(r => r.classList.remove('selected'));
		rows[this.currentIndex].classList.add('selected');
		rows[this.currentIndex].scrollIntoView({ block: 'nearest' });
	}
}
