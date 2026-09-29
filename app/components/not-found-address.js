import Component from '@glimmer/component';
import { action } from '@ember/object';
import {tracked} from '@glimmer/tracking'

export default class NotFoundAddressComponent extends Component {
  @tracked changedAddressName;

  get isRename() {
    return this.args.item.choice.type === 'rename';
  }

  get isLink() {
    return this.args.item.choice.type === 'link';
  }

  get isRemove() {
    return this.args.item.choice.type === 'remove';
  }

   @action
  changeNameTextBox(event) {
    this.changedAddressName = event.target.value;
  }

  @action
  selectRename() {
    this.args.onChange(this.args.item.index, {
      type: 'rename', address: this.args.item.address,
    });
  }

  @action
  selectLink() {
    this.args.onChange(this.args.item.index, {
      type: 'link', url: this.args.item.choice.url ?? '',
    });
  }

  @action
  selectRemove() {
    this.args.onChange(this.args.item.index, { type: 'remove' });
  }

  @action
  changeName() {
    this.args.onChange(this.args.item.index, {
      type: 'rename', address: this.changedAddressName,
    });
  }

  @action
  changeLink(event) {
    this.args.onChange(this.args.item.index, {
      type: 'link', url: event.target.value,
    });
  }
}
