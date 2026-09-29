import { helper } from '@ember/component/helper';

export default helper(function isLast([index, arr]) {
    return index === arr.length - 1;
});
