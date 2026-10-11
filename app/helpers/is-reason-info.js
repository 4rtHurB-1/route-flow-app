import { helper } from '@ember/component/helper';

export default helper(function isLast([reason]) {
    return /пенсія|газета|газети/i.test(reason);
});
