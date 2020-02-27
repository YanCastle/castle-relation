import Model, { M } from '@ctsy/model'
import * as _ from 'lodash'
import { array_columns } from 'castle-function';
import { resolve, join } from 'path';
/**
 * 关系配置
 */
export class RelationConfiger {
    /**
     * 属性名称/ObjectPropertyName
     */
    name: string = ''
    /**
     * 表名/TableName
     */
    table: string = ''
    /**
     * 字段列表，
     * @description 支持字符串数组，函数或以英文逗号分隔的字符串
     */
    fields: string[] | Function | string = []
    /**
     * 主表关联字段
     */
    pk: string = ''
    /**
     * 子表关联字段
     */
    fk?: string = ''
    /**
     * 是否级联关联
     * @description 若为true则表示自动读取该name对应的Relation
     */
    relation?: boolean | string | Relation = false
    /**
     * 附加查询条件
     * @description 可以为Function或者对象
     */
    where?: Object | Function = undefined
    constructor(config?: RelationConfiger) {
        if (config) {
            if (config.name) this.name = config.name
            if (config.table) this.table = config.table
            if (config.fields) {
                if ('string' == typeof config.fields) {
                    this.fields = config.fields.split(',')
                } else {
                    this.fields = config.fields
                }
            }
            if (config.pk) this.pk = config.pk
            this.fk = config.fk ? config.fk : config.pk
            this.relation = config.relation ? config.relation : false
            this.where = config.where ? config.where : undefined
        }
    }
}
/**
 * R调用关系对象
 * @param ctx 请求体
 * @param name 对象名称
 * @param prefix 对象表前缀
 */
export function R(ctx: any, name: string, prefix: string = ""): Relation {
    const Relations: any = {};
    if (!_.isObject(Relations[name])) {
        try {
            let rp = resolve(join(ctx.config.getLibPath(), 'relation', name))
            var r = require(rp).default;
            if (r) {
                Relations[name] = new r(ctx, name, ctx.config.getDbTableFields(name), ctx.config.getDbTablePK(name), prefix);
            } else {
                Relations[name] = new Relation(ctx, name, ctx.config.getDbTableFields(name), ctx.config.getDbTablePK(name), prefix);
            }
        } catch (e) {
            Relations[name] = new Relation(ctx, name, ctx.config.getDbTableFields(name), ctx.config.getDbTablePK(name), prefix);
        }
    }
    return Relations[name];
}

/**
 * 关系对象
 */
export default class Relation {
    protected _one: { [index: string]: RelationConfiger } = {};
    protected _many: { [index: string]: RelationConfiger } = {};
    protected _extend: { [index: string]: RelationConfiger } = {};
    protected _table = "";
    protected _pk = "";
    protected _fields: Array<string> = [];
    protected _model: Model;
    protected _controller: any;
    protected _foreach: any = [];
    protected _ctx: any = {};
    prefix: string = ""
    /**
     *
     * @param Table 表名
     * @param Fields 字段列表
     * @param PK 主键
     */
    public constructor(ctx: any, Table: string, Fields: string | Array<string> = "", PK = "", prefix: string = "") {
        this._table = Table;
        this._ctx = ctx;
        let _fields = [];
        if (Fields instanceof String) {
            _fields = Fields.split(',')
        }
        if (Fields.length == 0) {
            _fields = this._ctx.config.getDbTableFields(Table)
        }
        if (PK.length === 0) {
            PK = this._ctx.config.getDbTablePK(Table)
        }
        this._fields = _fields;
        this._pk = PK;
        this._model = M(ctx, Table, prefix);
        this.prefix = prefix;
    }

    /**
     * 可以不通过构造函数来添加属性信息
     * @param Table 表名
     * @param Fields 字段
     * @param PK 主键
     */
    public config(Table: string, Fields: string[], PK: string) {
        this._table = Table;
        this._fields = Fields;
        this._pk = PK;
        if (Table)
            this._model = new Model(this._ctx, Table);
    }
    /**
     * 拥有一个
     * @param {RelationConfiger} config 配置信息
     */
    public hasOne(config: RelationConfiger) {
        if (_.isString(config.name) && config.name.length > 0) {
            this.One = config;
        }
        return this;
    }
    get One() {
        return this._one;
    }
    set One(config: RelationConfiger | any) {
        if (_.isString(config.name) && config.name.length > 0) {
            this._one[config.name] = new RelationConfiger(config)
        }
    }
    /**
     * 有多个配置，一对多关系
     * @param {RelationConfiger} config 配置
     * @returns {boolean}
     */
    public hasMany(config: RelationConfiger) {
        this.Many = config;
        return this;
    }
    get Many() {
        return this._many;
    }
    set Many(config: RelationConfiger | any) {
        if (_.isString(config.name) && config.name.length > 0) {
            this._many[config.name] = new RelationConfiger(config)
        }
    }

    /**
     * 扩展字段配置
     * @param {RelationConfiger} config
     * @returns {boolean}
     */
    public extend(config: RelationConfiger) {
        if (_.isString(config.name) && config.name.length > 0) {
            this.Extend = config;
        }
        return this;
    }

    /**
     * 扩展关系
     * @returns {any}
     * @constructor
     */
    get Extend() {
        return this._extend;
    }

    /**
     * 
     * @param {RelationConfiger} config
     * @constructor
     */
    set Extend(config: RelationConfiger | any) {
        if (_.isString(config.name) && config.name.length > 0) {
            this._extend[config.name] = new RelationConfiger(config)
        }
    }
    /**
     * 函数判定和执行
     * @param w 
     */
    public eval(w: any) {
        if (w instanceof Function) {
            return w.apply(this, [this._ctx]);
        } else {
            return w;
        }
    }
    // set Fields(fields){
    //     this._fields=fields;
    // }
    // get Fields(){
    //     return this._fields;
    // }
    /**
     * 获取对象，对象化处理
     * @param {Array<Number>} PKValues 主键值
     * @returns {any}
     */
    public async objects(PKValues: Array<Number>) {
        if (PKValues instanceof Array) {
            let data = await this._model.fields(this._fields).where({
                [this._pk]: { 'in': PKValues }
            }).select()
            //开始循环属性配置并生成相关。。
            let Qs: any = [data];
            if (data instanceof Array) {
                // data = JSON.parse(JSON.stringify(data))
                _.forOwn(this.One, (v, k) => {
                    if (v instanceof Function) {
                        try {
                            v = v(data)
                        } catch (error) {
                        }
                    }
                    if (v.relation instanceof Relation) {
                        Qs.push(v.relation.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else if (!_.isString(v.relation)) {
                        Qs.push(new Model(this._ctx, v.table, this.prefix).fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else {
                        let r = new Relation(this._ctx, v.relation, '', '', this.prefix);
                        if (r instanceof Relation)
                            Qs.push(r.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    }
                })
                _.forOwn(this.Many, (v, k) => {
                    if (v instanceof Function) {
                        try {
                            v = v(data)
                        } catch (error) {

                        }
                    }
                    if (v.relation instanceof Relation) {
                        Qs.push(v.relation.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else if (!_.isString(v.relation)) {
                        Qs.push(new Model(this._ctx, v.table, this.prefix).fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else {
                        let r = new Relation(this._ctx, v.relation, '', '', this.prefix);
                        if (r instanceof Relation)
                            Qs.push(r.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    }
                })
                _.forOwn(this.Extend, (v, k) => {
                    if (v instanceof Function) {
                        try {
                            v = v(data)
                        } catch (error) {

                        }
                    }
                    if (v.relation instanceof Relation) {
                        Qs.push(v.relation.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else if (!_.isString(v.relation)) {
                        Qs.push(new Model(this._ctx, v.table, this.prefix).fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    } else {
                        let r = new Relation(this._ctx, v.relation, '', '', this.prefix);
                        if (r instanceof Relation)
                            Qs.push(r.fields(this.eval(v.fields)).where(this.eval(v.where)).where({ [v.fk ? v.fk : v.pk]: { 'in': array_columns(data, v.pk, true) } }).select())
                    }
                })
            }
            let result = await Promise.all(Qs)
            let i = 1, datae: any = result[0], one: any = {}, many: any = {}, extend: any = {}, config = {};
            _.forOwn(this._one, (v, k) => {
                one[v.name] = { values: result[i], config: v };
                i++;
            })
            _.forOwn(this._many, (v, k) => {
                many[v.name] = { values: result[i], config: v };
                i++;
            })
            _.forOwn(this._extend, (v, k) => {
                extend[v.name] = { values: result[i], config: v };
                i++;
            })
            _.forOwn(datae, (v, k) => {
                _.forOwn(one, (d: any, f) => {
                    let s = _.filter(d.values, { [d.config.fk]: datae[k][d.config.pk] });
                    datae[k][f] = s.length > 0 ? s[0] : {}
                })
                _.forOwn(many, (d: any, f) => {
                    let s = _.filter(d.values, { [d.config.fk]: datae[k][d.config.pk] });
                    datae[k][f] = s.length > 0 ? s.map((v) => {
                        delete v[d.config.pk]
                        return v;
                    }) : []
                })
                _.forOwn(extend, (d: any, f) => {
                    //TODO 检查所查询数据不存在的时候追加空数据
                    let s = _.filter(d.values, { [d.config.fk]: datae[k][d.config.pk] });
                    datae[k] = _.assign(v, s.length > 0 ? s[0] : {});
                })
                _.forOwn(this._foreach, (f: any, k: any) => {
                    if (_.isFunction(f)) {
                        f.apply(this, [datae[k]])
                    }
                })
            })
            return datae;
        } else {
            throw new Error('Relation Type Error')
        }
    }
    protected data_columns(arr: any, column: any) {
        let a: any = [];
        _.forOwn(arr, (v, k) => {
            a.push(v.dataValues[column])
        })
        return a
    }

    /**
     * 取出
     * @param arr
     * @returns {Array}
     */
    protected dataValues(arr: any, column: any = false) {
        let a: any = [];
        _.forOwn(arr, (v, k) => {
            if (false == column)
                a.push(v.dataValues)
            else
                a.push(v.dataValues[column])
        })
        return a
    }
    /**
     * Where查询条件设定
     * @param where 
     */
    public where(where: any) {
        this._model.where(where)
        return this;
    }
    /**
     * 自定义加载db配置文件
     * @param DbConfig 
     */
    public load(DbConfig: any | string = null, ) {
        var conf = {};
        if (DbConfig instanceof String) {
            //从定义目录加载
            conf = require(`${this._ctx.config.MODEL_PATH}/${DbConfig}`);
        } else if (_.isObject(DbConfig)) {

        }

    }
    /**
     * 设定查询字段范围
     * @param {string[]} fields
     * @returns {this}
     */
    public fields(fields: string[]) {
        this._fields = fields;
        return this;
    }
    /**
     * 查询并计数
     * @returns {rows:any[],count:number}
     */
    public async selectAndCount() {
        let d = await this._model.fields([this._pk]).selectAndCount()
        if (d.rows.length == 0) {
            return [[], 0];
        }
        var PKs: any = array_columns(d.rows, this._pk);
        return { rows: await this.objects(PKs), count: d.count }
    }
    /**
     * 排序规则
     * @param {string} order
     * @returns {this} 
     */
    public order(order: string) {
        this._model.order(order)
        return this;
    }
    public async save(data: Object) {
        return await this._model.save(data).then(c => {
            return c > -1;
        })
    }
    public page(page: number, number: number) {
        this._model.page(page, number)
        return this;
    }
    public async add(data: Object) {
        return await this._model.add(data).then((d: any) => {
            if (_.isObject(d) && d[this._pk] > 0) {
                return this.objects([d[this._pk]]).then(p => {
                    return p[0];
                })
            } else {
                return d;
            }
        })
    }
    public async del() {
        return await this._model.del();
    }
    public async select() {
        return await this._model.fields([this._pk]).select().then(d => {
            if (d instanceof Array && d.length > 0) {
                var PKs: any = array_columns(d, this._pk);
                return this.objects(PKs);
            } else {
                return [];
            }
        })
    }

    /**
     * 查询一个
     */
    public async find() {
        return await this._model.getFields(this._pk).then(d => {
            if (_.isNumber(d) && d > 0) {
                return this.objects([d]).then(data => {
                    return data instanceof Array && data.length > 0 ? data[0] : {}
                });
            } else {
                return {};
            }
        })
    }
}

