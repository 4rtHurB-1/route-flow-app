import { helper } from '@ember/component/helper';

export default helper(function isLast([reason]) {
    return ['Пенсія', 'Газети', "Газети; Пенсія"].includes(reason);
});
